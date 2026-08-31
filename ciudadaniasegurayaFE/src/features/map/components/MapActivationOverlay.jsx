export function MapActivationOverlay({ onActivate }) {
  return (
    <button
      type="button"
      className="map-activation"
      onClick={onActivate}
      aria-label="Activar controles del mapa"
    >
      <span className="map-activation__label">PRESIONE PARA EXPLORAR</span>
    </button>
  );
}
