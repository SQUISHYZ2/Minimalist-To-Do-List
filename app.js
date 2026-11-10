'use strict';

(() => {
    const STORAGE_KEY = 'todos';          // same key as before, so existing tasks carry over
    const MAX_LEN = 500;
    const DOUBLE_TAP_MS = 380;
    const DOUBLE_TAP_SLOP = 40;           // px the second tap may land from the first
    const HOLD_MS = 450;                  // how long a press is held before the task menu opens
    const HOLD_SLOP = 10;                 // px a held finger may wander
    const LEAVE_MS = 200;
    const SNOOZE_MS = 10 * 60 * 1000;
    const RING_MS = 60 * 1000;            // an unanswered reminder rings this long, then waits quietly
    const TICK_MS = 30 * 1000;            // the longest the reminder clock sleeps between looks
    const TONE_KEY = 'ringtone';
    const TONE_MAX = 10 * 1024 * 1024;    // the largest ringtone file kept on the device
    const SAFE_ID = /^[\w-]{1,64}$/;
    const CONTROLS = 'button, a, input, textarea, select, label';
    const reduceMotion = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
    const root = document.documentElement;
    const baseTitle = document.title;

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

        menu: $('#menu'),
        menuSheet: $('#menu-sheet'),
        viewMenu: $('#view-menu'),
        menuTitle: $('#menu-title'),
        actPriority: $('#menu [data-act="priority"]'),
        actRemind: $('#menu [data-act="remind"]'),

        viewRemind: $('#view-remind'),
        remindTitle: $('#remind-title'),
        remindCancel: $('#remind-cancel'),
        presetTomorrow: $('#preset-tomorrow'),
        remindDate: $('#remind-date'),
        remindTime: $('#remind-time'),
        remindHint: $('#remind-hint'),
        remindNote: $('#remind-note'),
        remindClear: $('#remind-clear'),
        remindSave: $('#remind-save'),
        tonePlay: $('#tone-play'),
        toneName: $('#tone-name'),
        toneReset: $('#tone-reset'),
        tonePick: $('#tone-pick'),
        toneFile: $('#tone-file'),
        toneNote: $('#tone-note'),

        alarm: $('#alarm'),
        alarmSheet: $('#alarm-sheet'),
        alarmTask: $('#alarm-task'),
        alarmWhen: $('#alarm-when'),
        alarmMore: $('#alarm-more'),
    };

    const ICON = {
        grip: '<svg viewBox="0 0 24 24" width="18" height="22" fill="currentColor" aria-hidden="true"><circle cx="9" cy="6" r="1.7"/><circle cx="15" cy="6" r="1.7"/><circle cx="9" cy="12" r="1.7"/><circle cx="15" cy="12" r="1.7"/><circle cx="9" cy="18" r="1.7"/><circle cx="15" cy="18" r="1.7"/></svg>',
        check: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path pathLength="1" d="M5.5 12.6l4.3 4.3L18.6 8"/></svg>',
        star: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.6l2.5 5.3 5.8.8-4.2 4.1 1 5.8L12 16.8l-5.1 2.8 1-5.8-4.2-4.1 5.8-.8L12 3.6z"/></svg>',
        edit: '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4.5 19.5l.9-4L16.6 4.3a2.1 2.1 0 0 1 3 3L8.4 18.6l-3.9.9z"/><path d="M14.5 6.5l3 3"/></svg>',
        trash: '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4.5 7h15M9.5 7V5h5v2M6.8 7l.9 12h8.6l.9-12M10 11v5M14 11v5"/></svg>',
        bell: '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4.4a5.3 5.3 0 0 0-5.3 5.3v3.4c0 .9-.3 1.7-.9 2.4l-.9 1.1h14.2l-.9-1.1a3.6 3.6 0 0 1-.9-2.4V9.7A5.3 5.3 0 0 0 12 4.4z"/><path d="M10 19.4a2.1 2.1 0 0 0 4 0M12 2.9v1.5"/></svg>',
        copy: '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="8.6" y="8.6" width="10.9" height="10.9" rx="2.6"/><path d="M15.4 8.6V6.7a2.2 2.2 0 0 0-2.2-2.2H6.7a2.2 2.2 0 0 0-2.2 2.2v6.5a2.2 2.2 0 0 0 2.2 2.2h1.9"/></svg>',
        close: '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M6.6 6.6l10.8 10.8M17.4 6.6L6.6 17.4"/></svg>',
        play: '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M8.4 5.5v13a.9.9 0 0 0 1.4.8l10-6.5a.9.9 0 0 0 0-1.6l-10-6.5a.9.9 0 0 0-1.4.8z"/></svg>',
        stop: '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><rect x="6.6" y="6.6" width="10.8" height="10.8" rx="2.4"/></svg>',
    };

    /* ------------------------------------------------------------------ *
     *  State & storage
     * ------------------------------------------------------------------ */

    /* The order of the list: unfinished above finished and, inside each of those, priority first.
       Ties keep their place, so the order you arrange by hand survives inside every group. */
    function rank(t) { return (t.completed ? 2 : 0) + (t.priority ? 0 : 1); }
    function sorted(list) {
        return list.map((t, i) => [t, i]).sort((a, b) => rank(a[0]) - rank(b[0]) || a[1] - b[1]).map((x) => x[0]);
    }

    const nodes = new Map();              // todo id -> <li>
    let savedRaw = null;                  // the list exactly as it last went into, or came out of, storage
    let todos = load();
    let editing = null;                   // { id, finish(commit, refocus) } while a row is being edited
    let drag = null;                      // active drag state
    let undoBatches = [];                 // [[{ todo, index }]] — every removal since the toast appeared
    let toastTimer = 0;
    let lastTap = { id: null, time: 0, x: 0, y: 0 };

    function uid() {
        if (window.crypto && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
        return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
    }

    function load() {
        let raw = [];
        savedRaw = null;
        try { savedRaw = localStorage.getItem(STORAGE_KEY); raw = JSON.parse(savedRaw || '[]'); } catch (_) { raw = []; }
        if (!Array.isArray(raw)) return [];
        const seen = new Set();
        return sorted(raw
            .filter((t) => t && typeof t.text === 'string' && t.text.trim())
            .map((t) => {
                // Older saves had no ids / priority flag / reminder — upgrade them quietly.
                let id = typeof t.id === 'string' && SAFE_ID.test(t.id) && !seen.has(t.id) ? t.id : uid();
                seen.add(id);
                return {
                    id,
                    text: t.text.trim().slice(0, MAX_LEN),
                    completed: !!t.completed,
                    priority: !!t.priority,
                    remindAt: typeof t.remindAt === 'number' && Number.isFinite(t.remindAt) && t.remindAt > 0 ? t.remindAt : null,   // when to ring, in epoch ms
                };
            }));
    }

    function save() {
        const raw = JSON.stringify(todos);
        try { localStorage.setItem(STORAGE_KEY, raw); savedRaw = raw; } catch (_) { /* private mode / quota */ }
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
            <div class="todo-body">
                <span class="todo-text"></span>
                <span class="sr-only prio-note" hidden>Priority.</span>
                <button type="button" class="remind" title="Change reminder" hidden>${ICON.bell}<span class="remind-when"></span></button>
            </div>
            <div class="actions">
                <button type="button" class="act edit" title="Edit">${ICON.edit}</button>
                <button type="button" class="act del" title="Delete">${ICON.trash}</button>
            </div>`;
        const cb = li.querySelector('.cb');
        cb.id = 'cb-' + todo.id;
        li.querySelector('.check').htmlFor = cb.id;
        li.querySelector('.todo-text').id = 'tx-' + todo.id;
        li.querySelector('.prio-note').id = 'pr-' + todo.id;
        cb.setAttribute('aria-labelledby', 'tx-' + todo.id);
        li.addEventListener('animationend', (e) => { if (e.target === li) li.classList.remove('enter'); });
        return li;
    }

    function syncItem(li, todo) {
        li.classList.toggle('done', todo.completed);
        li.classList.toggle('priority', todo.priority);
        const text = li.querySelector('.todo-text');
        if (text.textContent !== todo.text) text.textContent = todo.text;
        const cb = li.querySelector('.cb');
        cb.checked = todo.completed;
        // with no star to press, a priority is told to assistive tech in words
        li.querySelector('.prio-note').hidden = !todo.priority;
        if (todo.priority) cb.setAttribute('aria-describedby', 'pr-' + todo.id);
        else cb.removeAttribute('aria-describedby');
        const chip = li.querySelector('.remind');
        chip.hidden = !todo.remindAt;
        if (todo.remindAt) {
            const when = whenLabel(todo.remindAt);
            const label = chip.querySelector('.remind-when');
            if (label.textContent !== when) label.textContent = when;
            chip.setAttribute('aria-label', `Reminder ${when}, for “${todo.text}”. Change it.`);
        }
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

    /* FLIP: run a DOM-changing fn and glide every surviving row from where it was.
       `lead` is the row the change is about — it travels over the others, not under them. */
    function withFlip(fn, lead) {
        const first = new Map();
        for (const [id, li] of nodes) first.set(id, li.getBoundingClientRect().top);
        fn();
        for (const [id, li] of nodes) {
            if (!first.has(id) || li.classList.contains('leaving')) continue;
            const dy = first.get(id) - li.getBoundingClientRect().top;
            if (Math.abs(dy) < 1 || reduceMotion.matches || typeof li.animate !== 'function') continue;
            const frames = [{ transform: `translateY(${dy}px)` }, { transform: 'translateY(0)' }];
            if (id === lead) frames.forEach((f) => { f.zIndex = 2; });
            li.animate(frames, { duration: 380, easing: 'cubic-bezier(.2,.8,.2,1)' });
        }
    }

    /* A task has changed group: save, glide the rows to their new places and
       leave the keyboard on the control that was used (moving a node drops its focus). */
    function resettle(id) {
        const active = document.activeElement;
        save();
        withFlip(render, id);
        if (active && active !== document.activeElement && els.list.contains(active)) active.focus({ preventScroll: true });
    }

    /* ------------------------------------------------------------------ *
     *  Actions
     * ------------------------------------------------------------------ */

    function addTodo(text) {
        const todo = { id: uid(), text: text.slice(0, MAX_LEN), completed: false, priority: false, remindAt: null };
        todos.push(todo);
        todos = sorted(todos);                 // a new task joins the unfinished ones, above anything already done
        save();
        withFlip(() => render({ enter: [todo.id] }));
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
        flushDrag();                                                // a drop still gliding into place lands first
        const todo = find(id);
        if (!todo) return;
        const was = todos.indexOf(todo);
        todo.completed = checked;
        if (checked) { todos.splice(was, 1); todos.push(todo); }    // finished: to the bottom of the list…
        todos = sorted(todos);                                      // …and un-finished: back up with the rest
        const moved = todos.indexOf(todo) !== was;
        resettle(id);
        announce(`${todo.text} ${checked ? 'completed' : 'marked as not done'}${moved ? (checked ? ', moved down' : ', moved up') : ''}`);
    }

    /* `at` is where a double tap landed — a new priority gets a star there */
    function togglePriority(id, at) {
        flushDrag();
        const todo = find(id);
        if (!todo) return;
        const li = nodes.get(id);
        const box = at && li ? li.getBoundingClientRect() : null;     // where the row is now, before it moves up
        todo.priority = !todo.priority;
        todos = sorted(todos);
        resettle(id);
        if (todo.priority && box) burst(li, at.x - box.left, at.y - box.top);
        if (navigator.vibrate) navigator.vibrate(8);
        announce(`${todo.text} ${todo.priority ? 'marked as priority' : 'is no longer priority'}`);
    }

    /* the star belongs to the row, so it rides along as the row glides to its new place */
    function burst(li, x, y) {
        const star = document.createElement('span');
        star.className = 'burst';
        star.setAttribute('aria-hidden', 'true');
        star.innerHTML = ICON.star;
        star.style.left = x + 'px';
        star.style.top = y + 'px';
        const done = () => {
            star.remove();
            if (!li.querySelector('.burst')) li.classList.remove('bursting');
        };
        star.addEventListener('animationend', done);
        setTimeout(done, 1500);                     // should the animation never run
        li.classList.add('bursting');
        li.append(star);
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
            todos = sorted(todos);
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
        if (from < 0) return;
        // a task is reordered among its own kind — moving it never un-finishes or re-prioritises it
        if (to < 0 || to >= todos.length || rank(todos[to]) !== rank(todos[from])) {
            announce(`${todos[from].text} is at the ${delta < 0 ? 'top' : 'bottom'} of its group`);
            return;
        }
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
        body.querySelector('.todo-text').after(ta);     // above the reminder, where the text was
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

        // the stretch of rows this one may be dropped among: its own group (see rank)
        const kind = (el) => { const t = find(el.dataset.id); return t ? rank(t) : -1; };
        let lo = start, hi = start;
        while (lo > 0 && kind(items[lo - 1]) === kind(li)) lo--;
        while (hi < items.length - 1 && kind(items[hi + 1]) === kind(li)) hi++;

        drag = {
            li, grip, items, start, index: start, tops, hs, gap, lo, hi,
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
        // keep the lifted row within its own group
        const minDy = d.tops[d.lo] - d.tops[d.start];
        const maxDy = d.tops[d.hi] + d.hs[d.hi] - d.hs[d.start] - d.tops[d.start];
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
            let resync = false;
            try {
                const dragged = find(d.li.dataset.id);
                if (dragged && target !== d.start && d.li.isConnected && !d.li.classList.contains('leaving')) {
                    const rest = [...els.list.children].filter((el) => el !== d.li && !el.classList.contains('leaving'));
                    els.list.insertBefore(d.li, rest[target] || null);
                    const byId = new Map(todos.map((t) => [t.id, t]));
                    const ordered = [...els.list.children].map((el) => byId.get(el.dataset.id)).filter(Boolean);
                    if (ordered.length === todos.length) {
                        // a drop stays inside its group; sorting holds that even if the list changed during the glide
                        todos = sorted(ordered);
                        resync = todos.some((t, i) => t !== ordered[i]);
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
            if (resync) render();
        };
        d.settle = settle;

        if (immediate || reduceMotion.matches) { settle(); return; }

        d.li.classList.add('settling');
        d.li.style.transform = `translate3d(0, ${offset}px, 0)`;
        if (!commit) d.items.forEach((el) => { if (el !== d.li) el.style.transform = ''; });
        d.timer = setTimeout(settle, 230);
    }

    /* ------------------------------------------------------------------ *
     *  Times, said plainly
     * ------------------------------------------------------------------ */

    const timeFmt = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
    const dayFmt = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    const dayYearFmt = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    const pad = (n) => String(n).padStart(2, '0');
    const dateValue = (ts) => { const d = new Date(ts); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
    const timeValue = (ts) => { const d = new Date(ts); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
    const roundUp = (ts, step) => Math.ceil(ts / step) * step;
    const midnight = (ts) => new Date(ts).setHours(0, 0, 0, 0);

    /* "Today, 5:30 PM" · "Tomorrow, 9:00 AM" · "Fri, Nov 13, 9:00 AM" — lower-cased where it sits inside a sentence */
    function whenLabel(ts, inSentence = false) {
        const days = Math.round((midnight(ts) - midnight(Date.now())) / 86400000);
        let day = days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : days === -1 ? 'Yesterday' : '';
        if (day && inSentence) day = day.toLowerCase();
        if (!day) day = (new Date(ts).getFullYear() === new Date().getFullYear() ? dayFmt : dayYearFmt).format(ts);
        return `${day}, ${timeFmt.format(ts)}`;
    }

    function untilLabel(ms) {
        if (ms < 50 * 1000) return 'less than a minute';
        const mins = Math.round(ms / 60000);
        if (mins < 60) return `${mins} min`;
        const hours = Math.floor(mins / 60), rest = mins % 60;
        if (hours < 24) return rest ? `${hours} h ${rest} min` : `${hours} h`;
        const days = Math.floor(hours / 24), hrs = hours % 24;
        return `${days} ${days === 1 ? 'day' : 'days'}` + (hrs ? ` ${hrs} h` : '');
    }

    function tomorrowMorning() {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        d.setHours(9, 0, 0, 0);
        return d.getTime();
    }

    /* ------------------------------------------------------------------ *
     *  Sheets: modal dialogs in the middle of the screen
     * ------------------------------------------------------------------ */

    const isOpen = (dialog) => dialog.hasAttribute('open');

    function openModal(dialog) {
        if (isOpen(dialog)) return;
        if (typeof dialog.showModal === 'function') dialog.showModal();
        else dialog.setAttribute('open', '');           // a browser without <dialog>: shown, just not modal
        lockScroll();
    }

    function closeModal(dialog) {
        if (isOpen(dialog)) {
            if (typeof dialog.close === 'function') dialog.close();
            else dialog.removeAttribute('open');
        }
        lockScroll();
    }

    /* While a sheet is up the page behind it stays put. Where a scrollbar took up room,
       that room is kept (--sbw), so nothing shifts sideways. */
    function lockScroll() {
        const on = isOpen(els.menu) || isOpen(els.alarm);
        if (on === root.classList.contains('modal-open')) return;
        if (on) root.style.setProperty('--sbw', Math.max(0, window.innerWidth - root.clientWidth) + 'px');
        root.classList.toggle('modal-open', on);
    }

    /* ------------------------------------------------------------------ *
     *  Press and hold a task → its menu
     * ------------------------------------------------------------------ */

    let hold = null;                      // a press on a row that may yet become the menu
    let guard = false;                    // the press that opened the menu has not been let go yet
    let guardTimer = 0;
    let sheet = null;                     // { id, view, timer } while the menu / reminder editor is up
    let scrimDown = false;                // the press now in progress began outside the sheet
    let byKeyboard = false;               // how the last thing was asked for: decides where focus lands in a sheet
    const HOLD_ENDS = ['pointerup', 'pointercancel', 'blur'];
    const GUARD_LIFTS = ['pointerup', 'pointercancel', 'touchend', 'touchcancel', 'mouseup'];
    const GUARD_FRESH = ['pointerdown', 'keydown'];

    function startHold(e) {
        cancelHold();
        if (drag || !e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;
        const li = e.target.closest('.todo');
        // the row's own controls keep their plain press: a slow click on one must still be a click
        if (!li || li.classList.contains('leaving') || e.target.closest(CONTROLS)) return;
        hold = { id: li.dataset.id, li, x: e.clientX, y: e.clientY, timer: setTimeout(endHold, HOLD_MS) };
        li.classList.add('holding');
        window.addEventListener('pointermove', onHoldMove, { passive: true });
        window.addEventListener('scroll', cancelHold, { passive: true });
        HOLD_ENDS.forEach((type) => window.addEventListener(type, cancelHold));
    }

    function onHoldMove(e) {
        if (hold && Math.hypot(e.clientX - hold.x, e.clientY - hold.y) > HOLD_SLOP) cancelHold();
    }

    function cancelHold() {
        if (!hold) return;
        clearTimeout(hold.timer);
        hold.li.classList.remove('holding');
        hold = null;
        window.removeEventListener('pointermove', onHoldMove);
        window.removeEventListener('scroll', cancelHold);
        HOLD_ENDS.forEach((type) => window.removeEventListener(type, cancelHold));
    }

    /* held long enough */
    function endHold() {
        const held = hold;
        if (!held) return;
        cancelHold();
        if (drag || !find(held.id)) return;
        guardPress();
        if (navigator.vibrate) navigator.vibrate(10);
        openMenu(held.id);
    }

    /* The press that opens the menu is let go over it — perhaps right over one of its buttons.
       Whatever click that release makes is not meant for the menu, so it is swallowed,
       until the finger has clearly gone or a fresh press begins. */
    function guardPress() {
        dropGuard();
        guard = true;
        GUARD_LIFTS.forEach((type) => window.addEventListener(type, onGuardLift, true));
        GUARD_FRESH.forEach((type) => window.addEventListener(type, dropGuard, true));
    }

    function onGuardLift() {
        if (guard && !guardTimer) guardTimer = setTimeout(dropGuard, 400);
    }

    function dropGuard() {
        guard = false;
        clearTimeout(guardTimer);
        guardTimer = 0;
        GUARD_LIFTS.forEach((type) => window.removeEventListener(type, onGuardLift, true));
        GUARD_FRESH.forEach((type) => window.removeEventListener(type, dropGuard, true));
    }

    window.addEventListener('click', (e) => {
        if (!guard) return;
        e.preventDefault();
        e.stopPropagation();
        dropGuard();
    }, true);

    window.addEventListener('keydown', () => { byKeyboard = true; }, true);
    window.addEventListener('pointerdown', () => { byKeyboard = false; }, true);

    /* Asked for with the keyboard, a sheet hands focus to its first control. Asked for by touch or mouse,
       it keeps focus on itself, so no button looks picked before anything has been chosen. */
    function focusSheet(first) {
        (byKeyboard && first ? first : els.menuSheet).focus({ preventScroll: true });
    }

    function openMenu(id, view) {
        if (!find(id) || isOpen(els.alarm)) return;
        cancelHold();
        flushDrag();
        if (editing) editing.finish(true, false);       // the menu should name the task as it now reads
        if (sheet) clearInterval(sheet.timer);
        sheet = { id, view: 'menu', timer: 0 };
        paintSheet();
        openModal(els.menu);
        if (view === 'remind') showRemind();
        else focusSheet(els.actPriority);
    }

    function closeMenu() {
        if (sheet) clearInterval(sheet.timer);
        sheet = null;
        if (playing === 'preview') silence();
        closeModal(els.menu);
    }

    /* bring the sheet in line with its task — and put it away if the task is gone */
    function paintSheet() {
        const todo = sheet && find(sheet.id);
        if (!todo) { closeMenu(); return; }
        const remind = sheet.view === 'remind';
        els.viewMenu.hidden = remind;
        els.viewRemind.hidden = !remind;
        els.menu.setAttribute('aria-labelledby', remind ? 'remind-title' : 'menu-title');
        els.menuTitle.textContent = todo.text;
        els.remindTitle.textContent = todo.text;
        els.actPriority.classList.toggle('is-on', todo.priority);
        els.actPriority.querySelector('.menu-label').textContent = todo.priority ? 'Remove priority' : 'Mark as priority';
        els.actRemind.querySelector('.menu-label').textContent = todo.remindAt ? 'Change reminder' : 'Set a reminder';
        els.actRemind.querySelector('.menu-meta').textContent = todo.remindAt ? whenLabel(todo.remindAt) : '';
        els.remindClear.hidden = !todo.remindAt;
    }

    function copyText(text) {
        const told = (ok) => showToast(ok ? 'Copied' : 'Couldn’t copy that', false);
        const byHand = () => {
            const back = document.activeElement;
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.setAttribute('readonly', '');
            ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
            document.body.append(ta);
            ta.select();
            let ok = false;
            try { ok = document.execCommand('copy'); } catch (_) { ok = false; }
            ta.remove();
            if (back && back.focus) back.focus({ preventScroll: true });
            told(ok);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(() => told(true), byHand);
        else byHand();
    }

    /* ------------------------------------------------------------------ *
     *  The reminder editor
     * ------------------------------------------------------------------ */

    function showRemind() {
        const todo = sheet && find(sheet.id);
        if (!todo) { closeMenu(); return; }
        const now = Date.now();
        sheet.view = 'remind';
        els.remindDate.min = dateValue(now);
        // start from the reminder it has, or an hour from now on a round five minutes
        setPicked(todo.remindAt > now ? todo.remindAt : roundUp(now + 60 * 60000, 5 * 60000));
        els.presetTomorrow.textContent = `Tomorrow, ${timeFmt.format(tomorrowMorning())}`;
        paintSheet();
        paintHint();
        toneNote('');
        paintTone();
        paintNote();
        loadTone().then(paintTone);
        clearInterval(sheet.timer);
        sheet.timer = setInterval(paintHint, 20000);    // "rings in…" keeps up with the clock
        focusSheet(els.viewRemind.querySelector('[data-preset]'));
    }

    function setPicked(ts) {
        els.remindDate.value = dateValue(ts);
        els.remindTime.value = timeValue(ts);
    }

    /* the moment the two fields name, in this device's own time — NaN while either is unfilled */
    function picked() {
        const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(els.remindDate.value);
        const t = /^(\d{2}):(\d{2})/.exec(els.remindTime.value);
        return d && t ? new Date(+d[1], d[2] - 1, +d[3], +t[1], +t[2], 0, 0).getTime() : NaN;
    }

    function presetTime(key) {
        if (key === 'tomorrow') return tomorrowMorning();
        const mins = { '15m': 15, '1h': 60, '3h': 180 }[key] || 60;
        return roundUp(Date.now() + mins * 60000, 60000);   // never sooner than asked
    }

    function paintHint() {
        const at = picked(), now = Date.now();
        const problem = Number.isNaN(at) ? 'Choose a date and a time.' : at <= now ? 'That time has already passed.' : '';
        els.remindHint.textContent = problem || `Rings in ${untilLabel(at - now)}.`;
        els.remindHint.classList.toggle('bad', !!problem);
        return !problem;
    }

    function paintNote() {
        const state = 'Notification' in window ? Notification.permission : 'none';
        const missed = ' A reminder missed while Tasks was closed rings when you open it again.';
        els.remindNote.textContent =
            state === 'granted' ? 'Tasks has to be open to ring. In the background it also sends a notification.' + missed
            : state === 'denied' ? 'Tasks has to be on screen to ring, because notifications are blocked for it.' + missed
            : state === 'default' ? 'Tasks has to be open to ring. You’ll be asked to allow notifications, so it can reach you from the background.' + missed
            : 'Tasks has to be open to ring.' + missed;
    }

    function saveReminder() {
        const todo = sheet && find(sheet.id);
        if (!todo) { closeMenu(); return; }
        if (!paintHint()) {
            els.remindHint.classList.remove('nudge');
            void els.remindHint.offsetWidth;
            els.remindHint.classList.add('nudge');
            announce(els.remindHint.textContent);
            return;
        }
        const at = picked();
        prime();                                        // this tap is what lets the ringtone start by itself later
        askToNotify();
        todo.remindAt = at;
        save();
        closeMenu();
        withFlip(render);
        checkReminders();
        showToast(`Reminder set for ${whenLabel(at, true)}`, false);
    }

    function clearReminder() {
        const todo = sheet && find(sheet.id);
        closeMenu();
        if (!todo || !todo.remindAt) return;
        todo.remindAt = null;
        save();
        withFlip(render);
        checkReminders();
        showToast('Reminder removed', false);
    }

    /* ------------------------------------------------------------------ *
     *  The reminder clock
     * ------------------------------------------------------------------ */

    const alerts = [];                    // reminders that have come due and wait for an answer: { id, at }
    let clock = 0;
    let alarmShown = 0;                   // when the alarm appeared — it ignores input for a moment after that
    let ringing = false;
    let ringSeq = 0;
    let ringTimer = 0;
    let buzzTimer = 0;

    /* Ring whatever has come due, then sleep until the next reminder — never for long:
       a timer can oversleep while the device does, so the clock is read again on every look. */
    function checkReminders() {
        clearTimeout(clock);
        if (todos.some((t) => t.remindAt && t.remindAt <= Date.now())) {
            adoptSaved();                               // another window may already have rung it
            const now = Date.now();
            const due = todos.filter((t) => t.remindAt && t.remindAt <= now);
            if (due.length) {
                // a finished task has nothing left to remind about: its reminder just lapses
                const rung = due.filter((t) => !t.completed).map((t) => ({ id: t.id, at: t.remindAt }));
                due.forEach((t) => { t.remindAt = null; });
                save();                                 // …which also tells every other window it is dealt with
                withFlip(render);
                if (rung.length) raise(rung);
            }
        }
        repaintTimes();
        const next = Math.min(...todos.map((t) => t.remindAt || Infinity));
        if (next !== Infinity) clock = setTimeout(checkReminders, Math.max(200, Math.min(next - Date.now(), TICK_MS)));
    }

    /* "Tomorrow" turns into "Today" on its own */
    function repaintTimes() {
        for (const todo of todos) {
            const li = nodes.get(todo.id);
            if (li && todo.remindAt) syncItem(li, todo);
        }
        if (sheet) paintSheet();
    }

    /* take the list as it stands in storage, if it is not the one in hand */
    function adoptSaved() {
        let raw = null;
        try { raw = localStorage.getItem(STORAGE_KEY); } catch (_) { return; }
        if (raw !== savedRaw) syncFromStorage();
    }

    /* ------------------------------------------------------------------ *
     *  The alarm
     * ------------------------------------------------------------------ */

    function raise(rung) {
        cancelHold();
        if (editing) editing.finish(true, false);       // the alarm should name the task as it now reads
        for (const r of rung) {
            const waiting = alerts.find((a) => a.id === r.id);
            if (waiting) waiting.at = r.at;
            else alerts.push(r);
            notify(r);
        }
        paintAlarm();
        if (!isOpen(els.alarm)) {
            alarmShown = performance.now();
            openModal(els.alarm);
            els.alarmSheet.focus({ preventScroll: true });   // not a button: a key already on its way down must not answer it
        }
        ring();
    }

    function paintAlarm() {
        const first = alerts[0], todo = first && find(first.id);
        if (!todo) return;
        const more = alerts.length - 1;
        els.alarmTask.textContent = todo.text;
        els.alarmWhen.textContent = Date.now() - first.at > 90 * 1000 ? `Was due ${whenLabel(first.at, true)}` : whenLabel(first.at);
        els.alarmMore.textContent = more ? `${more} more ${more === 1 ? 'reminder is' : 'reminders are'} waiting.` : '';
        els.alarmMore.hidden = !more;
        document.title = `🔔 ${todo.text}`;
    }

    /* done · snooze · dismiss, for the reminder on show */
    function answer(how) {
        const first = alerts.shift();
        stopRing();
        if (first) {
            unnotify(first.id);
            const todo = find(first.id);
            if (todo && how === 'done' && !todo.completed) toggleDone(todo.id, true);
            else if (todo && how === 'snooze') {
                todo.remindAt = Date.now() + SNOOZE_MS;
                save();
                withFlip(render);
                announce(`Snoozed. ${todo.text} rings again at ${timeFmt.format(todo.remindAt)}`);
            }
        }
        settleAlarm();
        checkReminders();
    }

    /* drop what no longer needs an answer, then show the next reminder or put the alarm away */
    function settleAlarm() {
        for (let i = alerts.length - 1; i >= 0; i--) {
            const todo = find(alerts[i].id);
            if (!todo || todo.completed) { unnotify(alerts[i].id); alerts.splice(i, 1); }
        }
        if (alerts.length) paintAlarm();
        else closeAlarm();
    }

    function closeAlarm() {
        stopRing();
        alerts.splice(0).forEach((a) => unnotify(a.id));
        document.title = baseTitle;
        closeModal(els.alarm);
    }

    function ring() {
        stopRing();
        const seq = ++ringSeq;
        ringing = true;
        els.alarm.classList.add('ringing');
        ringTimer = setTimeout(stopRing, RING_MS);
        buzz();
        buzzTimer = setInterval(buzz, 2200);
        loadTone().then(() => { if (ringing && seq === ringSeq) play('ring'); });
    }

    /* a browser only lets a page that has been tapped vibrate; asking before that just earns a warning */
    const canBuzz = () => !!navigator.vibrate && (!navigator.userActivation || navigator.userActivation.hasBeenActive);

    function buzz() {
        try { if (canBuzz()) navigator.vibrate([400, 180, 400]); } catch (_) { /* no motor here */ }
    }

    function stopRing() {
        if (!ringing) return;
        ringing = false;
        clearTimeout(ringTimer);
        clearInterval(buzzTimer);
        els.alarm.classList.remove('ringing');
        try { if (canBuzz()) navigator.vibrate(0); } catch (_) { /* no motor here */ }
        if (playing === 'ring') silence();
    }

    /* ------------------------------------------------------------------ *
     *  The ringtone: a built-in chime, or a sound file of the user's own
     * ------------------------------------------------------------------ */

    const tone = { url: '', name: '', stamp: 0 };   // the chosen file; no url → the chime
    let chimeUrl = '';
    let player = null;                    // the one <audio> every sound goes through
    let playing = null;                   // 'ring' | 'preview' | null
    let playSeq = 0;
    let primed = false;
    let dbOpen = null;

    const chime = () => chimeUrl || (chimeUrl = URL.createObjectURL(makeChime()));

    /* A soft four-note chime, played twice, as a WAV made on the spot — nothing to download, so it rings offline. */
    function makeChime() {
        const rate = 22050, len = Math.round(rate * 2.6);
        const wave = new Float32Array(len);
        const strike = (freq, at) => {
            const from = Math.round(at * rate), w = 2 * Math.PI * freq / rate;
            const until = Math.min(len, from + Math.round(rate * 1.5));
            for (let i = from; i < until; i++) {
                const n = i - from;
                const env = Math.min(1, n / 60) * Math.exp(-5 * n / rate);       // a quick strike, a long fade
                wave[i] += env * (Math.sin(w * n) + .32 * Math.sin(2 * w * n) + .1 * Math.sin(3 * w * n));
            }
        };
        [659.26, 830.61, 987.77, 1318.51].forEach((freq, i) => { strike(freq, i * .15); strike(freq, 1.05 + i * .15); });

        let peak = 0;
        for (let i = 0; i < len; i++) peak = Math.max(peak, Math.abs(wave[i]));
        const out = new DataView(new ArrayBuffer(44 + len * 2));
        const tag = (at, word) => { for (let i = 0; i < 4; i++) out.setUint8(at + i, word.charCodeAt(i)); };
        tag(0, 'RIFF'); out.setUint32(4, 36 + len * 2, true); tag(8, 'WAVE');
        tag(12, 'fmt '); out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, 1, true);
        out.setUint32(24, rate, true); out.setUint32(28, rate * 2, true); out.setUint16(32, 2, true); out.setUint16(34, 16, true);
        tag(36, 'data'); out.setUint32(40, len * 2, true);
        const fade = rate * .08;                        // no click where the loop turns over
        for (let i = 0; i < len; i++) {
            out.setInt16(44 + i * 2, Math.round(wave[i] / peak * .85 * Math.min(1, (len - i) / fade) * 32767), true);
        }
        return new Blob([out], { type: 'audio/wav' });
    }

    /* 'ring' loops until it is stopped; 'preview' plays once */
    function play(mode, url) {
        const seq = ++playSeq;
        const src = url || tone.url || chime();
        const own = src !== chimeUrl;
        try {
            const a = player || (player = new Audio());
            const fail = (err) => {
                if (seq !== playSeq) return;                                    // something newer has the player
                // the browser wants a tap before any sound, or the sound was cut off: stay quiet
                if (!own || (err && (err.name === 'NotAllowedError' || err.name === 'AbortError'))) { silence(); return; }
                if (mode === 'preview') toneNote('That file can’t be played here, so the chime will ring instead.');
                play(mode, chime());                                            // a file that won't play must not cost the alert
            };
            playing = mode;
            a.onerror = () => fail();
            a.onended = () => { if (seq === playSeq) silence(); };
            a.loop = mode === 'ring';
            a.muted = false;
            a.volume = 1;
            a.src = src;
            const started = a.play();
            if (started && started.catch) started.catch(fail);
        } catch (_) {
            playing = null;                             // no audio on this device
        }
        paintTone();
    }

    function silence() {
        playSeq++;
        playing = null;
        if (player) {
            player.onerror = player.onended = null;
            player.pause();
            player.removeAttribute('src');              // lets go of the file, and of any lock-screen controls
            try { player.load(); } catch (_) { /* nothing to let go of */ }
        }
        paintTone();
    }

    /* iOS lets a page start a sound by itself only through an <audio> that was first touched during a tap. */
    function prime() {
        if (primed) return;
        primed = true;
        try {
            if (!player) player = new Audio();
            if (!playing) player.load();
        } catch (_) { /* no audio on this device */ }
    }

    function paintTone() {
        const previewing = playing === 'preview';
        els.toneName.textContent = tone.url ? tone.name : 'Chime';
        els.toneReset.hidden = !tone.url;
        els.tonePlay.innerHTML = previewing ? ICON.stop : ICON.play;
        els.tonePlay.setAttribute('aria-label', previewing ? 'Stop the ringtone' : 'Play the ringtone');
    }

    function toneNote(message) {
        els.toneNote.textContent = message;
        els.toneNote.hidden = !message;
    }

    /* a small key–value shelf in IndexedDB: the one place a sound file can be kept */
    function kv(mode, work) {
        if (!dbOpen) {
            dbOpen = new Promise((resolve, reject) => {
                const req = indexedDB.open('todo-app', 1);
                req.onupgradeneeded = () => req.result.createObjectStore('kv');
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
            });
        }
        return dbOpen.then((db) => new Promise((resolve, reject) => {
            const tx = db.transaction('kv', mode);
            const req = work(tx.objectStore('kv'));
            tx.oncomplete = () => resolve(req.result);
            tx.onabort = tx.onerror = () => reject(tx.error);
        }));
    }

    /* read the saved ringtone (another window may have changed it); never rejects */
    function loadTone() {
        return kv('readonly', (store) => store.get(TONE_KEY)).then((rec) => {
            const kept = rec && rec.buf ? rec : null;
            if ((kept ? kept.stamp : 0) !== tone.stamp) setTone(kept);
        }).catch(() => { /* no IndexedDB: the chime it is */ });
    }

    function setTone(rec) {
        if (tone.url) {
            if (playing && player && player.src === tone.url) silence();
            URL.revokeObjectURL(tone.url);
        }
        tone.url = rec ? URL.createObjectURL(new Blob([rec.buf], { type: rec.type || '' })) : '';
        tone.name = rec ? String(rec.name || 'My ringtone') : '';
        tone.stamp = rec ? rec.stamp : 0;
    }

    function chooseTone(file) {
        if (playing === 'preview') silence();
        if (!file.size) { toneNote('That file is empty.'); return; }
        if (file.size > TONE_MAX) { toneNote(`That file is too big. Choose one under ${TONE_MAX / 1048576} MB.`); return; }
        toneNote('');
        canPlay(file)
            .then((ok) => { if (!ok) throw new Error('unplayable'); return readFile(file); })
            .then((buf) => {
                const rec = { name: file.name || 'My ringtone', type: file.type || '', buf, stamp: Date.now() };
                return kv('readwrite', (store) => store.put(rec, TONE_KEY)).then(() => rec);
            })
            .then((rec) => {
                setTone(rec);
                paintTone();
                announce(`Ringtone set to ${tone.name}`);
            })
            .catch((err) => toneNote(err && err.message === 'unplayable'
                ? 'That file can’t be played here. Try an MP3, M4A or WAV.'
                : 'That ringtone couldn’t be saved on this device.'));
    }

    function resetTone() {
        if (playing === 'preview') silence();
        toneNote('');
        kv('readwrite', (store) => store.delete(TONE_KEY)).catch(() => {}).then(() => {
            setTone(null);
            paintTone();
            announce('Ringtone set to the chime');
        });
    }

    /* can this file be played here? true unless the browser says no outright */
    function canPlay(file) {
        return new Promise((resolve) => {
            let url = '', probe = null, timer = 0, settled = false;
            const done = (ok) => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                if (probe) {
                    probe.onloadedmetadata = probe.onerror = null;
                    probe.removeAttribute('src');
                    try { probe.load(); } catch (_) { /* already let go */ }
                }
                if (url) URL.revokeObjectURL(url);
                resolve(ok);
            };
            try {
                url = URL.createObjectURL(file);
                probe = new Audio();
                probe.preload = 'metadata';
                probe.onloadedmetadata = () => done(true);
                probe.onerror = () => done(false);
                timer = setTimeout(() => done(true), 4000);     // no verdict (iOS reads nothing until asked to play): trust it — the chime stands by
                probe.src = url;
            } catch (_) {
                done(false);
            }
        });
    }

    function readFile(file) {
        if (typeof file.arrayBuffer === 'function') return file.arrayBuffer();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error);
            reader.readAsArrayBuffer(file);
        });
    }

    /* ------------------------------------------------------------------ *
     *  System notifications — how a reminder reaches someone who is not looking at the app
     * ------------------------------------------------------------------ */

    const pageNotes = new Map();          // notifications shown without the service worker: todo id -> Notification

    const swRegistration = () => ('serviceWorker' in navigator
        ? navigator.serviceWorker.getRegistration().catch(() => undefined)
        : Promise.resolve(undefined));

    function askToNotify() {
        if (!('Notification' in window) || Notification.permission !== 'default') return;
        try {
            const asked = Notification.requestPermission();
            if (asked && asked.catch) asked.catch(() => {});
        } catch (_) { /* this browser will simply not notify */ }
    }

    function notify(alert) {
        const todo = find(alert.id);
        if (!todo || !('Notification' in window) || Notification.permission !== 'granted') return;
        if (document.visibilityState === 'visible' && document.hasFocus()) return;      // the alarm is in plain sight
        const title = todo.text.length > 110 ? todo.text.slice(0, 107) + '…' : todo.text;
        const basics = { body: `Reminder for ${whenLabel(alert.at, true)}`, tag: 'reminder-' + todo.id, icon: 'icons/manifest-icon-192.maskable.png' };
        const fromPage = () => {
            try {
                const note = new Notification(title, basics);
                note.onclick = () => { window.focus(); note.close(); };
                pageNotes.set(todo.id, note);
            } catch (_) { /* Android only notifies through a service worker */ }
        };
        swRegistration().then((reg) => {
            if (!reg || !reg.active || !reg.showNotification) { fromPage(); return; }
            reg.showNotification(title, { ...basics, renotify: true, requireInteraction: true, vibrate: [400, 180, 400] }).catch(fromPage);
        });
    }

    function unnotify(id) {
        const note = pageNotes.get(id);
        if (note) { note.close(); pageNotes.delete(id); }
        swRegistration()
            .then((reg) => (reg && reg.getNotifications ? reg.getNotifications({ tag: 'reminder-' + id }) : []))
            .then((notes) => notes.forEach((n) => n.close()))
            .catch(() => {});
    }

    /* ------------------------------------------------------------------ *
     *  Toast
     * ------------------------------------------------------------------ */

    /* A removal can be undone from its toast; anything else is a plain note that leaves sooner. */
    function showToast(message, undoable = true) {
        clearTimeout(toastTimer);
        if (!undoable) undoBatches = [];      // a note takes the toast's place, and the offer to undo goes with it
        els.toastMsg.textContent = message;
        els.toastUndo.hidden = !undoable;
        els.toast.classList.toggle('plain', !undoable);
        els.toast.hidden = false;
        requestAnimationFrame(() => requestAnimationFrame(() => els.toast.classList.add('show')));
        toastTimer = setTimeout(hideToast, undoable ? 6500 : 3200);
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
        if (e.target.closest('.remind')) return openMenu(id, 'remind');
        if (e.target.closest('.act.edit')) return startEdit(id);
        if (e.target.closest('.del')) return removeTodos([id], 'Task deleted');

        // a double tap anywhere on the row that is not one of its controls makes it a priority, or stops it being one
        // (hand-rolled, so it is the same on touch as with a mouse)
        if (e.target.closest(CONTROLS) || li.classList.contains('editing') || li.classList.contains('leaving')) return;
        const again = lastTap.id === id
            && e.timeStamp - lastTap.time < DOUBLE_TAP_MS
            && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < DOUBLE_TAP_SLOP;
        if (again) {
            lastTap = { id: null, time: 0, x: 0, y: 0 };
            togglePriority(id, { x: e.clientX, y: e.clientY });
        } else {
            lastTap = { id, time: e.timeStamp, x: e.clientX, y: e.clientY };
        }
    });

    els.list.addEventListener('pointerdown', (e) => {
        const grip = e.target.closest('.grip');
        if (grip) beginDrag(e, grip);
        else startHold(e);
    });

    // right-click, the menu key, and Android's own long press all ask for the same menu
    els.list.addEventListener('contextmenu', (e) => {
        if (e.target.closest('.edit-field')) return;            // text being edited keeps the browser's menu (paste…)
        e.preventDefault();
        const li = e.target.closest('.todo');
        if (!li || drag || li.classList.contains('leaving')) return;    // a long press on the handle is already a drag
        const pressed = !!hold;                                 // the phone's own long press got here before our timer did
        cancelHold();
        if (pressed) {
            guardPress();
            if (navigator.vibrate) navigator.vibrate(10);
        }
        openMenu(li.dataset.id);
    });

    els.menu.addEventListener('pointerdown', (e) => { scrimDown = e.target === els.menu; });

    els.menu.addEventListener('click', (e) => {
        if (e.target === els.menu) {                            // outside the sheet
            if (scrimDown) closeMenu();
            scrimDown = false;
            return;
        }
        const btn = e.target.closest('button');
        if (!btn) return;
        const todo = sheet && find(sheet.id);
        if (!todo) { closeMenu(); return; }
        const id = todo.id;
        switch (btn.dataset.act) {
            case 'priority': closeMenu(); togglePriority(id); return;
            case 'remind': showRemind(); return;
            case 'edit': closeMenu(); startEdit(id); return;
            case 'copy': closeMenu(); copyText(todo.text); return;
            case 'delete': closeMenu(); removeTodos([id], 'Task deleted'); return;
            default:
        }
        if (btn.dataset.preset) { setPicked(presetTime(btn.dataset.preset)); paintHint(); }
        else if (btn === els.remindSave) saveReminder();
        else if (btn === els.remindClear) clearReminder();
        else if (btn === els.remindCancel) closeMenu();
        else if (btn === els.tonePlay) { if (playing === 'preview') silence(); else { toneNote(''); play('preview'); } }
        else if (btn === els.tonePick) els.toneFile.click();
        else if (btn === els.toneReset) resetTone();
    });

    els.menu.addEventListener('keydown', (e) => {
        if (!sheet) return;
        if (sheet.view === 'menu' && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
            const items = [...els.viewMenu.querySelectorAll('.menu-item')];
            const at = items.indexOf(document.activeElement);
            const step = e.key === 'ArrowDown' ? 1 : -1;
            e.preventDefault();
            items[at < 0 ? (step > 0 ? 0 : items.length - 1) : (at + step + items.length) % items.length].focus();
        } else if (sheet.view === 'remind' && e.key === 'Enter' && (e.target === els.remindDate || e.target === els.remindTime)) {
            e.preventDefault();
            saveReminder();
        }
    });

    // Escape, the back button… however the dialog was closed, the state behind it follows
    els.menu.addEventListener('close', () => { if (!isOpen(els.menu)) closeMenu(); });

    els.remindDate.addEventListener('input', paintHint);
    els.remindTime.addEventListener('input', paintHint);
    els.remindHint.addEventListener('animationend', () => els.remindHint.classList.remove('nudge'));

    els.toneFile.addEventListener('change', () => {
        const file = els.toneFile.files && els.toneFile.files[0];
        els.toneFile.value = '';                                // choosing the same file twice still counts
        if (file) chooseTone(file);
    });

    els.alarm.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-answer]');
        // it may appear right under a tap that was meant for the list: nothing counts for the first moment
        if (btn && performance.now() - alarmShown > 400) answer(btn.dataset.answer);
    });
    els.alarm.addEventListener('cancel', (e) => { if (performance.now() - alarmShown <= 400) e.preventDefault(); });
    els.alarm.addEventListener('close', () => { if (!isOpen(els.alarm)) closeAlarm(); });     // Escape dismisses

    // the sheets are not text to be selected, and a long press on them is not a request for the browser's menu
    [els.menu, els.alarm].forEach((dialog) => dialog.addEventListener('contextmenu', (e) => {
        if (!e.target.closest('input')) e.preventDefault();
    }));

    // a reminder waiting to ring: the first tap anywhere readies the sound (see prime)
    const primeOnTap = () => { if (!primed && todos.some((t) => t.remindAt)) prime(); };
    ['click', 'keydown', 'touchend'].forEach((type) => document.addEventListener(type, primeOnTap, { capture: true, passive: true }));

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
        syncFromStorage();
        checkReminders();                                       // its reminders are ours to ring too
    });

    function syncFromStorage() {
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
        if (sheet) paintSheet();                                // the open menu follows its task, or goes with it
        if (alerts.length) settleAlarm();                       // a reminder answered elsewhere needs no answer here
    }

    function paintDate() {
        els.today.textContent = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
    }
    document.addEventListener('visibilitychange', () => { if (!document.hidden) { paintDate(); checkReminders(); } });
    // timers sleep when the device does — look at the clock again whenever the app is back in front
    window.addEventListener('focus', () => checkReminders());
    window.addEventListener('pageshow', () => checkReminders());

    /* ------------------------------------------------------------------ *
     *  Boot
     * ------------------------------------------------------------------ */

    document.querySelectorAll('[data-icon]').forEach((el) => { el.innerHTML = ICON[el.dataset.icon] || ''; });
    paintDate();
    render();
    save();                                // persist the id/priority upgrade of legacy data
    checkReminders();                      // ring anything that came due while the app was closed, and start the clock
    if (todos.some((t) => t.remindAt)) loadTone();

    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js').catch((err) => console.warn('Service worker registration failed:', err));
        });
    }
})();
