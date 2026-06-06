import './Loader.css'

/**
 * Loader animado con gradiente brand.
 * @param {boolean} fullPage - Ocupa toda la pantalla
 * @param {boolean} inline - Versión pequeña inline
 * @param {string} text - Texto debajo del spinner (solo en fullPage)
 */
function Loader({ fullPage = false, inline = false, text = '' }) {
  const classes = [
    'loader',
    fullPage && 'loader--fullpage',
    inline && 'loader--inline',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={classes}>
      <div className="loader__ring" />
      {fullPage && text && <span className="loader__text">{text}</span>}
    </div>
  )
}

export default Loader
