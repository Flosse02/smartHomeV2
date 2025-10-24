export function updateDateTime(el) {
    if(!el) return;

    const tick = () => {
        const now = new Date();
        el.textContent = now.toLocaleString(undefined, {
        weekday: 'short',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
        });
    };
    tick();
    return setInterval(tick, 1000);
}