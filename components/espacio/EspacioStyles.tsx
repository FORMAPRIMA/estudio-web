// CSS compartido por todas las etapas del Espacio. Se inyecta una sola vez desde
// el layout de /espacio. Nace del bloque de estilos de la landing de Bienvenida y
// añade utilidades comunes (tarjetas, animaciones de entrada).

export default function EspacioStyles() {
  return (
    <style>{`
      .fp-espacio * { box-sizing: border-box; margin: 0; padding: 0; }
      .fp-espacio {
        font-family: 'Inter', system-ui, -apple-system, sans-serif;
        background: #F8F6F1;
        color: #1A1A1A;
        min-height: 100vh;
        -webkit-font-smoothing: antialiased;
      }

      .fp-section-label {
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.15em;
        text-transform: uppercase;
        color: #D85A30;
        margin-bottom: 14px;
        display: block;
      }

      .fp-btn-primary {
        background: #D85A30;
        color: #fff;
        border: none;
        border-radius: 4px;
        padding: 16px 32px;
        font-size: 15px;
        font-weight: 500;
        cursor: pointer;
        width: 100%;
        letter-spacing: 0.01em;
        transition: background 0.2s;
        font-family: inherit;
      }
      .fp-btn-primary:hover { background: #C24E26; }
      .fp-btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

      .fp-btn-ghost {
        background: transparent;
        color: #1A1A1A;
        border: 1px solid #E5E2DA;
        border-radius: 4px;
        padding: 14px 28px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: border-color 0.2s, color 0.2s;
        font-family: inherit;
      }
      .fp-btn-ghost:hover { border-color: #D85A30; color: #D85A30; }

      .fp-input {
        padding: 12px 14px;
        border: 1px solid #E5E2DA;
        border-radius: 4px;
        font-size: 14px;
        width: 100%;
        background: #fff;
        color: #1A1A1A;
        font-family: inherit;
        outline: none;
        transition: border-color 0.15s;
      }
      .fp-input:focus { border-color: #D85A30; }

      .fp-field-label {
        display: block;
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: #888;
        margin-bottom: 6px;
      }

      .fp-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
      @media (max-width: 600px) { .fp-grid-2 { grid-template-columns: 1fr; } }

      .fp-stats-row { display: flex; gap: 40px; flex-wrap: wrap; margin-top: 40px; }
      @media (max-width: 500px) { .fp-stats-row { gap: 28px; } }

      .fp-socios-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 32px; }
      @media (max-width: 680px) { .fp-socios-grid { grid-template-columns: 1fr; } }

      /* Resumen ejecutivo de la propuesta: 1 columna en móvil, --cols en ≥560px */
      .fp-prop-summary { grid-template-columns: 1fr; }
      @media (min-width: 560px) {
        .fp-prop-summary { grid-template-columns: repeat(var(--cols, 3), 1fr); }
      }

      .fp-card {
        background: #fff;
        border: 1px solid #E5E2DA;
        border-radius: 8px;
        padding: clamp(20px, 4vw, 32px);
      }

      .fp-carousel::-webkit-scrollbar { display: none; }

      @keyframes bounce {
        0%, 100% { transform: translateY(0); opacity: 0.5; }
        50%       { transform: translateY(6px); opacity: 1; }
      }
      .fp-bounce { animation: bounce 2s ease-in-out infinite; }

      @keyframes kenBurns {
        from { transform: scale(1);    }
        to   { transform: scale(1.07); }
      }
      .fp-hero-active { animation: kenBurns 6s ease-out forwards; }

      @keyframes fadeSlideUp {
        from { opacity: 0; transform: translateY(8px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      .fp-hero-label { animation: fadeSlideUp 0.6s ease forwards; }

      /* ── Cronograma (Gantt) ─────────────────────────────────────────────── */
      .fp-gantt-row {
        display: grid;
        grid-template-columns: minmax(0, 200px) 1fr;
        align-items: center;
        gap: 16px;
      }
      .fp-gantt-label { display: flex; flex-direction: column; gap: 2px; }
      .fp-gantt-track {
        position: relative;
        height: 26px;
        background: #F6F4EF;
        border-radius: 6px;
        overflow: hidden;
      }
      .fp-gantt-bar {
        position: absolute;
        top: 4px;
        bottom: 4px;
        min-width: 6px;
        border-radius: 5px;
        animation: fadeSlideUp 0.5s ease both;
      }
      /* Fases sin duración definida: relleno difuminado + brillo en movimiento que
         transmite "aún por concretar". */
      .fp-gantt-bar-open {
        background:
          linear-gradient(90deg,
            var(--bar-color) 0%,
            color-mix(in srgb, var(--bar-color) 55%, transparent) 55%,
            color-mix(in srgb, var(--bar-color) 8%, transparent) 100%);
        background-size: 200% 100%;
        animation: fadeSlideUp 0.5s ease both, ganttShimmer 2.6s ease-in-out infinite;
      }
      @keyframes ganttShimmer {
        0%, 100% { background-position: 0% 0; opacity: 0.85; }
        50%      { background-position: 60% 0; opacity: 1; }
      }
      @media (max-width: 560px) {
        .fp-gantt-row { grid-template-columns: 1fr; gap: 6px; }
      }
    `}</style>
  )
}
