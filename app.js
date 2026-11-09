'use strict';

(() => {
    const STORAGE_KEY = 'todos';          // same key as before, so existing tasks carry over
    const MAX_LEN = 500;
    const DOUBLE_TAP_MS = 380;
    const LEAVE_MS = 200;
    const SAFE_ID = /^[\w-]{1,64}$/;
    const reduceMotion = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

    const $ = (sel) => document.querySelector(sel);
    const els = {
        form: $('#composer'),
        input: $('#todo-input'),
        list: $('#todo-list'),
        empty: $('#empty'),
        foot: $('#foot'),
        clearDone: $('#clear-done'),
        summary: $('#summary'),
        today: $('#today'),
        toast: $('#toast'),
        toastMsg: $('#toast-msg'),
        toastUndo: $('#toast-undo'),
        live: $('#live'),
    };

    const ICON = {
        grip: '<svg viewBox="0 0 24 24" width="18" height="22" fill="currentColor" aria-hidden="true"><circle cx="9" cy="6" r="1.7"/><circle cx="15" cy="6" r="1.7"/><circle cx="9" cy="12" r="1.7"/><circle cx="15" cy="12" r="1.7"/><circle cx="9" cy="18" r="1.7"/><circle cx="15" cy="18" r="1.7"/></svg>',
        check: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path pathLength="1" d="M5.5 12.6l4.3 4.3L18.6 8"/></svg>',
        star: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.6l2.5 5.3 5.8.8-4.2 4.1 1 5.8L12 16.8l-5.1 2.8 1-5.8-4.2-4.1 5.8-.8L12 3.6z"/></svg>',
        edit: '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4.5 19.5l.9-4L16.6 4.3a2.1 2.1 0 0 1 3 3L8.4 18.6l-3.9.9z"/><path d="M14.5 6.5l3 3"/></svg>',
        trash: '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4.5 7h15M9.5 7V5h5v2M6.8 7l.9 12h8.6l.9-12M10 11v5M14 11v5"/></svg>',
    };

    /* ------------------------------------------------------------------ *
     *  State & storage
     * ------------------------------------------------------------------ */

    const nodes = new Map();              // todo id -> <li>
    let todos = load();
    let editing = null;                   // { id, finish(commit, refocus) } while a row is being edited
    let drag = null;                      // active drag state
    let undoBatches = [];                 // [[{ todo, index }]] — every removal since the toast appeared
    let toastTimer = 0;
    let lastTap = { id: null, time: 0 };

    function uid() {
        if (window.crypto && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
        return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
    }

    function load() {
        let raw = [];
        try { raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch (_) { raw = []; }
        if (!Array.isArray(raw)) return [];
        const seen = new Set();
        return raw
            .filter((t) => t && typeof t.text === 'string' && t.text.trim())
            .map((t) => {
                // Older saves had no ids / priority flag — upgrade them quietly.
                let id = typeof t.id === 'string' && SAFE_ID.test(t.id) && !seen.has(t.id) ? t.id : uid();
                seen.add(id);
                return { id, text: t.text.trim().slice(0, MAX_LEN), completed: !!t.completed, priority: !!t.priority };
            });
    }

    function save() {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(todos)); } catch (_) { /* private mode / quota */ }
    }

    const find = (id) => todos.find((t) => t.id === id);
    const announce = (msg) => { els.live.textContent = ''; setTimeout(() => { els.live.textContent = msg; }, 30); };

    /* ------------------------------------------------------------------ *
     *  Rendering (keyed — rows are created once and re-used)
     * ------------------------------------------------------------------ */

    function buildItem(todo) {
        const li = document.createElement('li');
        li.className = 'todo glass';
        li.dataset.id = todo.id;
        // Static markup only — ids and text are assigned through the DOM, never parsed as HTML.
        li.innerHTML = `
            <button type="button" class="grip">${ICON.grip}</button>
            <input type="checkbox" class="cb">
            <label class="check">${ICON.check}</label>
            <div class="todo-body"><span class="todo-text"></span></div>
            <div class="actions">
                <button type="button" class="act star" aria-pressed="false" title="Priority">${ICON.star}</button>
                <button type="button" class="act edit" title="Edit">${ICON.edit}</button>
                <button type="button" class="act del" title="Delete">${ICON.trash}</button>
            </div>`;
        const cb = li.querySelector('.cb');
        cb.id = 'cb-' + todo.id;
        li.querySelector('.check').htmlFor = cb.id;
        li.querySelector('.todo-text').id = 'tx-' + todo.id;
        cb.setAttribute('aria-labelledby', 'tx-' + todo.id);
        li.addEventListener('animationend', (e) => {
            if (e.target === li) li.classList.remove('enter');
            else if (e.target.closest && e.target.closest('.star')) e.target.closest('.star').classList.remove('popping');
        });
        return li;
    }

    function syncItem(li, todo) {
        li.classList.toggle('done', todo.completed);
        li.classList.toggle('priority', todo.priority);
        const text = li.querySelector('.todo-text');
        if (text.textContent !== todo.text) text.textContent = todo.text;
        li.querySelector('.cb').checked = todo.completed;
        const star = li.querySelector('.star');
        star.setAttribute('aria-pressed', String(todo.priority));
        star.setAttribute('aria-label', todo.priority ? 'Remove priority' : 'Mark as priority');
        star.title = todo.priority ? 'Remove priority' : 'Mark as priority';
        li.querySelector('.grip').setAttribute('aria-label', `Reorder “${todo.text}”. Use up and down arrow keys, or drag.`);
        li.querySelector('.edit').setAttribute('aria-label', `Edit “${todo.text}”`);
        li.querySelector('.del').setAttribute('aria-label', `Delete “${todo.text}”`);
    }

    const visibleRows = () => [...els.list.children].filter((el) => !el.classList.contains('leaving'));

    function render(opts = {}) {
        flushDrag();

        const enter = opts.enter || [];
        const live = new Set(todos.map((t) => t.id));

        for (const [id, li] of nodes) {
            if (!live.has(id) && !li.classList.contains('leaving')) { li.remove(); nodes.delete(id); }
        }

        todos.forEach((todo, i) => {
            let li = nodes.get(todo.id);
            if (!li) {
                li = buildItem(todo);
                nodes.set(todo.id, li);
                if (enter.includes(todo.id)) li.classList.add('enter');
            }
            syncItem(li, todo);
            const expected = visibleRows()[i];
            if (expected !== li) els.list.insertBefore(li, expected || null);
        });

        updateChrome();
    }

    function updateChrome() {
        const total = todos.length;
        const left = todos.filter((t) => !t.completed);
        const prio = left.filter((t) => t.priority).length;

        let msg;
        if (!total) msg = 'A clean slate.';
        else if (!left.length) msg = 'All done. Lovely.';
        else msg = `${left.length} ${left.length === 1 ? 'task' : 'tasks'} left` + (prio ? ` · ${prio} priority` : '');
        els.summary.textContent = msg;

        els.empty.hidden = total > 0;
        els.foot.hidden = !todos.some((t) => t.completed);
    }

    /* FLIP: run a DOM-changing fn and glide every surviving row from where it was */
    function withFlip(fn) {
        const first = new Map();
        for (const [id, li] of nodes) first.set(id, li.getBoundingClientRect().top);
        fn();
        for (const [id, li] of nodes) {
            if (!first.has(id) || li.classList.contains('leaving')) continue;
            const dy = first.get(id) - li.getBoundingClientRect().top;
            if (Math.abs(dy) < 1 || reduceMotion.matches || typeof li.animate !== 'function') continue;
            li.animate(
                [{ transform: `translateY(${dy}px)` }, { transform: 'translateY(0)' }],
                { duration: 380, easing: 'cubic-bezier(.2,.8,.2,1)' }
            );
        }
    }

    /* ------------------------------------------------------------------ *
     *  Actions
     * ------------------------------------------------------------------ */

    function addTodo(text) {
        const todo = { id: uid(), text: text.slice(0, MAX_LEN), completed: false, priority: false };
        todos.push(todo);
        save();
        render({ enter: [todo.id] });
        const li = nodes.get(todo.id);
        if (li) {
            // measure the row at rest — the .enter keyframe starts it at translateY(-10px) scale(.96)
            li.classList.remove('enter');
            li.scrollIntoView({ block: 'nearest', behavior: reduceMotion.matches ? 'auto' : 'smooth' });
            li.classList.add('enter');
        }
        announce(`Added “${todo.text}”`);
    }

    function toggleDone(id, checked) {
        const todo = find(id);
        if (!todo) return;
        todo.completed = checked;
        save();
        syncItem(nodes.get(id), todo);
        updateChrome();
        announce(`${todo.text} ${checked ? 'completed' : 'marked as not done'}`);
    }

    function togglePriority(id) {
        const todo = find(id);
        if (!todo) return;
        todo.priority = !todo.priority;
        save();
        const li = nodes.get(id);
        syncItem(li, todo);
        li.querySelector('.star').classList.toggle('popping', todo.priority);
        updateChrome();
        announce(`${todo.text} ${todo.priority ? 'marked as priority' : 'is no longer priority'}`);
    }

    function removeTodos(ids, message) {
        if (!ids.length) return;
        if (editing) editing.finish(true, false);
        const gone = new Set(ids);

        // Keep the keyboard user's place: hand focus to the same control on the nearest surviving row.
        const active = document.activeElement;
        const rows = visibleRows();
        const fromRow = active && active.closest && active.closest('.todo');
        let focusNext = null;
        if ((fromRow && gone.has(fromRow.dataset.id)) || active === els.clearDone) {
            const at = fromRow ? rows.indexOf(fromRow) : 0;
            const survivor = rows.slice(at + 1).concat(rows.slice(0, at).reverse()).find((li) => !gone.has(li.dataset.id));
            const cls = '.' + ((active.classList.contains('act') ? active.classList[1] : active.classList[0]) || 'del');
            focusNext = survivor ? survivor.querySelector(cls) || survivor.querySelector('.del') : els.input;
        }

        // Remember exactly what was removed (and where) so Undo touches nothing else.
        undoBatches.push(todos.map((todo, index) => ({ todo: { ...todo }, index })).filter((x) => gone.has(x.todo.id)));
        todos = todos.filter((t) => !gone.has(t.id));
        save();

        ids.forEach((id, n) => {
            const li = nodes.get(id);
            if (!li) return;
            li.style.transitionDelay = `${Math.min(n, 8) * 25}ms`;
            li.classList.add('leaving');
        });
        updateChrome();
        if (focusNext && focusNext !== els.clearDone) focusNext.focus({ preventScroll: true });

        setTimeout(() => {
            const stale = ids.filter((id) => { const li = nodes.get(id); return li && li.classList.contains('leaving'); });
            if (!stale.length) return;               // Undo already brought them back — leave any new drag alone
            flushDrag();                             // geometry is about to change under any live drag
            withFlip(() => {
                stale.forEach((id) => { nodes.get(id).remove(); nodes.delete(id); });
            });
        }, LEAVE_MS + Math.min(ids.length, 8) * 25);

        const count = undoBatches.reduce((n, b) => n + b.length, 0);
        showToast(undoBatches.length > 1 ? `${count} tasks deleted` : message);
    }

    function undo() {
        if (!undoBatches.length) return;
        const batches = undoBatches;
        undoBatches = [];
        const focusWasInToast = els.toast.contains(document.activeElement);
        hideToast();
        const restoredIds = [];
        withFlip(() => {
            // Rows still mid-"leave" are the ones we're bringing back — drop the stale nodes first.
            for (const [id, li] of nodes) if (li.classList.contains('leaving')) { li.remove(); nodes.delete(id); }
            // Newest removal first, so every remembered index refers to the list as it was at that moment.
            for (let b = batches.length - 1; b >= 0; b--) {
                for (const { todo, index } of batches[b]) {
                    if (find(todo.id)) continue;
                    todos.splice(Math.min(index, todos.length), 0, todo);
                    restoredIds.push(todo.id);
                }
            }
            save();
            render({ enter: restoredIds });
        });
        if (focusWasInToast && restoredIds.length) {
            const li = nodes.get(restoredIds[0]);       // the most recently deleted row
            if (li) li.querySelector('.del').focus({ preventScroll: true });
        }
        announce(restoredIds.length === 1 ? 'Task restored' : `${restoredIds.length} tasks restored`);
    }

    function moveBy(id, delta) {
        const from = todos.findIndex((t) => t.id === id);
        const to = from + delta;
        if (from < 0 || to < 0 || to >= todos.length) return;
        withFlip(() => {
            const [t] = todos.splice(from, 1);
            todos.splice(to, 0, t);
            save();
            render();
        });
        const grip = nodes.get(id) && nodes.get(id).querySelector('.grip');
        if (grip) grip.focus();
        announce(`${find(id).text}, position ${to + 1} of ${todos.length}`);
    }

    /* ------------------------------------------------------------------ *
     *  Inline editing
     * ------------------------------------------------------------------ */

    function startEdit(id) {
        if (drag) return;
        if (editing) {
            if (editing.id === id) return;
            editing.finish(true, false);
        }
        const todo = find(id);
        const li = nodes.get(id);
        if (!todo || !li || li.classList.contains('leaving')) return;

        const body = li.querySelector('.todo-body');
        const ta = document.createElement('textarea');
        ta.className = 'edit-field';
        ta.rows = 1;
        ta.maxLength = MAX_LEN;
        ta.value = todo.text;
        ta.setAttribute('aria-label', 'Edit task');
        ta.enterKeyHint = 'done';
        body.append(ta);
        li.classList.add('editing');

        const fit = () => { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; };
        fit();
        ta.focus();
        ta.setSelectionRange(ta.value.length, ta.value.length);

        window.addEventListener('resize', fit);   // rotation / window resize changes how many lines it needs

        let finished = false;
        const finish = (commit, refocus) => {
            if (finished) return;
            finished = true;
            editing = null;
            window.removeEventListener('resize', fit);
            const next = ta.value.replace(/\s+/g, ' ').trim();
            if (commit && next && next !== todo.text) {
                todo.text = next;
                save();
                announce(`Updated to “${next}”`);
            }
            ta.remove();
            li.classList.remove('editing');
            syncItem(li, todo);
            if (refocus) li.querySelector('.act.edit').focus();
        };
        editing = { id, finish, ta };

        ta.addEventListener('input', fit);
        ta.addEventListener('blur', () => finish(true, false));
        ta.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); finish(true, true); }
            else if (e.key === 'Escape') { e.preventDefault(); finish(false, true); }
        });
    }

    /* ------------------------------------------------------------------ *
     *  Drag to reorder (pointer events → mouse, touch and pen)
     * ------------------------------------------------------------------ */

    function beginDrag(e, grip) {
        if (drag && drag.ending && drag.settle) drag.settle();      // a quick re-grab finishes the previous drop now
        if (drag || (e.pointerType === 'mouse' && e.button !== 0)) return;
        const li = grip.closest('.todo');
        if (!li || li.classList.contains('editing')) return;
        if (els.list.querySelector('.todo.leaving')) return;        // layout is about to shift; measurements would go stale
        const items = visibleRows();
        if (items.length < 2) return;
        e.preventDefault();

        const start = items.indexOf(li);
        const tops = items.map((el) => el.offsetTop);
        const hs = items.map((el) => el.offsetHeight);
        const gap = Math.max(0, tops[1] - (tops[0] + hs[0]));

        drag = {
            li, grip, items, start, index: start, tops, hs, gap,
            startY: e.clientY, y: e.clientY, startScroll: window.scrollY,
            maxScroll: Math.max(0, document.documentElement.scrollHeight - window.innerHeight),
            pointerId: e.pointerId, raf: 0, ending: false, settle: null, timer: 0,
        };

        try { grip.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
        li.classList.add('dragging');
        els.list.classList.add('is-dragging');
        document.documentElement.classList.add('no-select');
        if (navigator.vibrate) navigator.vibrate(8);

        grip.addEventListener('pointermove', onDragMove);
        grip.addEventListener('pointerup', onDragUp);
        grip.addEventListener('pointercancel', onDragCancel);
        drag.raf = requestAnimationFrame(dragTick);
        updateDrag();
    }

    /* finish any drag right now: commit a drop that is still gliding, cancel one that is live */
    function flushDrag() {
        if (!drag) return;
        if (drag.ending) { if (drag.settle) drag.settle(); }
        else endDrag(false, true);
    }

    const onDragMove =(e) => { if (drag && e.pointerId === drag.pointerId) { drag.y = e.clientY; } };
    const onDragUp = (e) => { if (drag && e.pointerId === drag.pointerId) endDrag(true); };
    const onDragCancel = () => endDrag(false);

    function dragTick() {
        if (!drag || drag.ending) return;
        const edge = 90, max = 18, vh = window.innerHeight;
        let v = 0;
        if (drag.y < edge) v = -Math.min(1, (edge - drag.y) / edge) * max;
        else if (drag.y > vh - edge) v = Math.min(1, (drag.y - (vh - edge)) / edge) * max;
        // never scroll past where the page ended when the drag began (the lifted row must not grow the page)
        if (v > 0) v = Math.min(v, Math.max(0, drag.maxScroll - window.scrollY));
        if (v) window.scrollBy(0, v);
        updateDrag();
        drag.raf = requestAnimationFrame(dragTick);
    }

    function updateDrag() {
        const d = drag;
        // keep the lifted row within the list's own extent
        const last = d.items.length - 1;
        const minDy = d.tops[0] - d.tops[d.start];
        const maxDy = d.tops[last] + d.hs[last] - d.hs[d.start] - d.tops[d.start];
        const dy = Math.max(minDy, Math.min(maxDy, d.y - d.startY + (window.scrollY - d.startScroll)));
        d.li.style.transform = `translate3d(0, ${dy}px, 0) scale(1.025)`;

        // a neighbour is passed once the lifted row's *leading* edge crosses its middle
        // (so the first and last slots are always reachable, whatever the row heights)
        const top = d.tops[d.start] + dy;
        const bottom = top + d.hs[d.start];
        let idx = d.start;
        for (let j = 0; j < d.items.length; j++) {
            const mid = d.tops[j] + d.hs[j] / 2;
            if (j > d.start && bottom > mid) idx++;
            else if (j < d.start && top < mid) idx--;
        }
        if (idx === d.index) return;
        d.index = idx;

        const shift = d.hs[d.start] + d.gap;
        d.items.forEach((el, j) => {
            if (j === d.start) return;
            let s = 0;
            if (j > d.start && j <= idx) s = -shift;
            else if (j < d.start && j >= idx) s = shift;
            el.style.transform = s ? `translate3d(0, ${s}px, 0)` : '';
        });
        if (navigator.vibrate) navigator.vibrate(3);
    }

    function endDrag(commit, immediate = false) {
        const d = drag;
        if (!d || d.ending) return;
        d.ending = true;
        cancelAnimationFrame(d.raf);
        d.grip.removeEventListener('pointermove', onDragMove);
        d.grip.removeEventListener('pointerup', onDragUp);
        d.grip.removeEventListener('pointercancel', onDragCancel);
        try { d.grip.releasePointerCapture(d.pointerId); } catch (_) { /* ignore */ }

        const target = commit ? d.index : d.start;
        let offset = 0;
        if (target > d.start) for (let j = d.start + 1; j <= target; j++) offset += d.hs[j] + d.gap;
        else if (target < d.start) for (let j = target; j < d.start; j++) offset -= d.hs[j] + d.gap;

        let settled = false;
        const settle = () => {
            if (settled) return;
            settled = true;
            clearTimeout(d.timer);
            els.list.classList.add('no-anim');
            try {
                const dragged = find(d.li.dataset.id);
                if (dragged && target !== d.start && d.li.isConnected && !d.li.classList.contains('leaving')) {
                    const rest = [...els.list.children].filter((el) => el !== d.li && !el.classList.contains('leaving'));
                    els.list.insertBefore(d.li, rest[target] || null);
                    const byId = new Map(todos.map((t) => [t.id, t]));
                    const ordered = [...els.list.children].map((el) => byId.get(el.dataset.id)).filter(Boolean);
                    if (ordered.length === todos.length) {
                        todos = ordered;
                        save();
                        announce(`${dragged.text}, position ${todos.indexOf(dragged) + 1} of ${todos.length}`);
                    }
                }
            } finally {
                d.items.forEach((el) => { el.style.transform = ''; });
                d.li.classList.remove('dragging', 'settling');
                els.list.classList.remove('is-dragging');
                document.documentElement.classList.remove('no-select');
                void els.list.offsetHeight;               // commit the un-transformed layout before transitions return
                els.list.classList.remove('no-anim');
                if (drag === d) drag = null;
            }
        };
        d.settle = settle;

        if (immediate || reduceMotion.matches) { settle(); return; }

        d.li.classList.add('settling');
        d.li.style.transform = `translate3d(0, ${offset}px, 0)`;
        if (!commit) d.items.forEach((el) => { if (el !== d.li) el.style.transform = ''; });
        d.timer = setTimeout(settle, 230);
    }

    /* ------------------------------------------------------------------ *
     *  Toast
     * ------------------------------------------------------------------ */

    function showToast(message) {
        clearTimeout(toastTimer);
        els.toastMsg.textContent = message;
        els.toast.hidden = false;
        requestAnimationFrame(() => requestAnimationFrame(() => els.toast.classList.add('show')));
        toastTimer = setTimeout(hideToast, 6500);
    }

    function hideToast() {
        clearTimeout(toastTimer);
        undoBatches = [];                     // once the toast is gone, so is the chance to undo
        if (els.toast.contains(document.activeElement)) els.input.focus({ preventScroll: true });
        els.toast.classList.remove('show');
        toastTimer = setTimeout(() => { els.toast.hidden = true; }, 350);
    }

    /* ------------------------------------------------------------------ *
     *  Events
     * ------------------------------------------------------------------ */

    els.form.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = els.input.value.replace(/\s+/g, ' ').trim();
        if (!text) {
            els.form.classList.remove('nudge');
            void els.form.offsetWidth;
            els.form.classList.add('nudge');
            els.input.focus();
            return;
        }
        addTodo(text);
        els.input.value = '';
        els.input.focus();
    });
    els.form.addEventListener('animationend', () => els.form.classList.remove('nudge'));

    els.list.addEventListener('change', (e) => {
        const cb = e.target.closest('.cb');
        if (cb) toggleDone(cb.closest('.todo').dataset.id, cb.checked);
    });

    els.list.addEventListener('click', (e) => {
        const li = e.target.closest('.todo');
        if (!li) return;
        const id = li.dataset.id;
        if (e.target.closest('.star')) return togglePriority(id);
        if (e.target.closest('.act.edit')) return startEdit(id);
        if (e.target.closest('.del')) return removeTodos([id], 'Task deleted');

        // double-click / double-tap on the text to edit (hand-rolled so it also works on touch)
        if (e.target.closest('.todo-text')) {
            const now = e.timeStamp;
            if (lastTap.id === id && now - lastTap.time < DOUBLE_TAP_MS) {
                lastTap = { id: null, time: 0 };
                window.getSelection && window.getSelection().removeAllRanges();
                startEdit(id);
            } else {
                lastTap = { id, time: now };
            }
        }
    });

    els.list.addEventListener('pointerdown', (e) => {
        const grip = e.target.closest('.grip');
        if (grip) beginDrag(e, grip);
    });

    els.list.addEventListener('contextmenu', (e) => { if (e.target.closest('.grip')) e.preventDefault(); });

    els.list.addEventListener('keydown', (e) => {
        const grip = e.target.closest('.grip');
        if (!grip) return;
        const id = grip.closest('.todo').dataset.id;
        if (e.key === 'ArrowUp') { e.preventDefault(); moveBy(id, -1); }
        else if (e.key === 'ArrowDown') { e.preventDefault(); moveBy(id, 1); }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && drag) { e.preventDefault(); endDrag(false); }
    });

    // Light that follows the pointer across the glass
    document.addEventListener('pointermove', (e) => {
        if (e.pointerType === 'touch') return;
        const glass = e.target.closest && e.target.closest('.glass');
        if (!glass) return;
        const r = glass.getBoundingClientRect();
        glass.style.setProperty('--mx', (e.clientX - r.left) + 'px');
        glass.style.setProperty('--my', (e.clientY - r.top) + 'px');
    }, { passive: true });

    els.clearDone.addEventListener('click', () => {
        const ids = todos.filter((t) => t.completed).map((t) => t.id);
        removeTodos(ids, ids.length === 1 ? '1 completed task cleared' : `${ids.length} completed tasks cleared`);
    });

    els.toastUndo.addEventListener('click', undo);

    // keep other tabs / the installed app in sync
    window.addEventListener('storage', (e) => {
        if (e.key !== STORAGE_KEY && e.key !== null) return;
        // Another tab changed the list: take its version, but keep any half-typed edit alive.
        let draft = null;
        if (editing) {
            draft = { id: editing.id, value: editing.ta.value, start: editing.ta.selectionStart, end: editing.ta.selectionEnd };
            editing.finish(false, false);
        }
        if (els.toast.classList.contains('show')) hideToast();   // remembered positions no longer apply
        todos = load();
        render();
        if (draft && nodes.has(draft.id)) {
            startEdit(draft.id);
            if (editing) {
                editing.ta.value = draft.value;
                editing.ta.setSelectionRange(draft.start, draft.end);
                editing.ta.dispatchEvent(new Event('input'));     // re-fit the height
            }
        }
    });

    function paintDate() {
        els.today.textContent = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
    }
    document.addEventListener('visibilitychange', () => { if (!document.hidden) paintDate(); });

    /* ------------------------------------------------------------------ *
     *  Boot
     * ------------------------------------------------------------------ */

    paintDate();
    render();
    save();                                // persist the id/priority upgrade of legacy data

    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js').catch((err) => console.warn('Service worker registration failed:', err));
        });
    }
})();
