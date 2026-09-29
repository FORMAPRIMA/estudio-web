// Animaciones de entrada de cada diapositiva. Portadas tal cual del script del
// diseño en Claude Design (el <script data-dc-script> del .dc.html), para que la
// propuesta publicada se mueva igual que la que se diseñó. Lo único distinto:
// aquí cada diapositiva lleva su propio juego de animaciones, porque en móvil
// hay varias en pantalla a la vez y una no puede cortar las de otra.

type Remate = { finish: () => void }

const E = 'cubic-bezier(.16,1,.3,1)'

export function sinMovimiento(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export class Animador {
  private vivas = new Map<Element, Remate[]>()
  private carruseles = new Map<Element, Animation>()

  /** Deja todas las animaciones en su estado final (antes de imprimir, al salir). */
  terminarTodo() {
    this.vivas.forEach((rs) => rs.forEach((r) => { try { r.finish() } catch {} }))
    this.vivas.clear()
  }

  terminar(slide: Element) {
    this.vivas.get(slide)?.forEach((r) => { try { r.finish() } catch {} })
    this.vivas.delete(slide)
  }

  carrusel(slide: Element, activo: boolean) {
    const track = slide.querySelector<HTMLElement>('[data-carousel]')
    if (!track) return
    this.carruseles.get(slide)?.cancel()
    this.carruseles.delete(slide)
    track.style.transform = ''
    if (!activo || sinMovimiento()) return
    const dup = track.querySelector<HTMLElement>('[data-dup]')
    const loop = dup?.offsetTop
    if (!loop) return
    const a = track.animate(
      [{ transform: 'translate3d(0,0,0)' }, { transform: `translate3d(0,${-loop}px,0)` }],
      { duration: (loop / 45) * 1000, iterations: Infinity, easing: 'linear' },
    )
    this.carruseles.set(slide, a)
  }

  pararCarruseles() {
    this.carruseles.forEach((a) => a.cancel())
    this.carruseles.clear()
  }

  animar(slide: HTMLElement) {
    this.terminar(slide)
    if (sinMovimiento()) return
    const remates: Remate[] = []
    this.vivas.set(slide, remates)

    const run = (el: Element, kf: Keyframe[], o: KeyframeAnimationOptions) => {
      const a = el.animate(kf, Object.assign({ easing: E, fill: 'backwards' as FillMode }, o))
      remates.push(a)
      return a
    }

    // transición de la diapositiva
    run(slide, [{ opacity: 0 }, { opacity: 1 }], { duration: 700, easing: 'cubic-bezier(.4,0,.2,1)' })

    // bloques escalonados
    const isLogo = (el: Element) => el.tagName === 'IMG' && /logo|isotipo/.test(el.getAttribute('src') || '')
    const blocks: HTMLElement[] = []
    const collect = (el: HTMLElement, depth: number) => {
      const kids = (Array.from(el.children) as HTMLElement[]).filter(
        (k) => (k.offsetWidth > 0 && getComputedStyle(k).position !== 'absolute') || k.tagName === 'IMG',
      )
      if (depth < 2 && kids.length > 1 && el !== slide && el.offsetHeight > 160 && !/^H\d$/.test(el.tagName)) {
        kids.forEach((k) => collect(k, depth + 1))
        return
      }
      blocks.push(el)
    }
    ;(Array.from(slide.children) as HTMLElement[]).forEach((c) => {
      const cs = getComputedStyle(c)
      if (cs.position === 'absolute' && c.children.length > 1) (Array.from(c.children) as HTMLElement[]).forEach((k) => collect(k, 1))
      else if (cs.position === 'absolute') return
      else collect(c, 0)
    })
    let i = 0
    const delayOf = new Map<Element, number>()
    blocks.forEach((b) => {
      const d = 220 + Math.min(i, 14) * 70
      i++
      delayOf.set(b, d)
      if (isLogo(b)) return
      if (/^H\d$/.test(b.tagName)) {
        run(b, [{ opacity: 0, transform: 'translate3d(0,28px,0)' }, { opacity: 1, transform: 'translate3d(0,0,0)' }], { duration: 1400, delay: d })
      } else {
        run(b, [{ opacity: 0, transform: 'translate3d(0,16px,0)' }, { opacity: 1, transform: 'translate3d(0,0,0)' }], { duration: 1200, delay: d })
      }
    })
    const delayFor = (el: Element | null) => {
      let n = el
      while (n && n !== slide) {
        if (delayOf.has(n)) return delayOf.get(n)!
        n = n.parentElement
      }
      return 300
    }

    // imágenes: telón + asentamiento lento
    slide.querySelectorAll('img').forEach((img) => {
      if (isLogo(img)) return
      const d = delayFor(img)
      run(img, [{ opacity: 0 }, { opacity: 1 }], { duration: 1800, delay: d, easing: 'cubic-bezier(.33,0,.2,1)' })
      run(img, [{ transform: 'scale3d(1.05,1.05,1)' }, { transform: 'scale3d(1,1,1)' }], { duration: 3200, delay: d, easing: 'cubic-bezier(.22,1,.36,1)' })
    })

    // logos / isotipo
    slide.querySelectorAll('img').forEach((img) => {
      if (!isLogo(img)) return
      const d = 500 + (img.offsetHeight > 30 ? 200 : 0)
      run(img, [{ opacity: 0, transform: 'translate3d(0,6px,0)' }, { opacity: getComputedStyle(img).opacity, transform: 'translate3d(0,0,0)' }], { duration: 1600, delay: d, easing: 'cubic-bezier(.33,0,.2,1)' })
    })

    // barras del cronograma (desktop: alto 40px en rejilla; mobile: data-bar), puntos de pago, rombos de revisión
    const bars = (Array.from(slide.querySelectorAll('div')) as HTMLElement[]).filter(
      (el) => el.hasAttribute('data-bar') || (el.style.height === '40px' && !!el.style.gridColumn),
    )
    bars.forEach((b, k) => {
      const d = 650 + k * 220
      const dur = 1500
      b.style.transformOrigin = '0 50%'
      b.style.willChange = 'transform'
      run(b, [{ transform: 'scale3d(0,1,1)' }, { transform: 'scale3d(1,1,1)' }], { duration: dur, delay: d, easing: 'cubic-bezier(.65,0,.25,1)' })
      const col = getComputedStyle(b).color
      run(b, [{ color: 'rgba(0,0,0,0)' }, { color: col }], { duration: 500, delay: d + dur - 250, easing: 'linear' })
      b.querySelectorAll('span[style*="border-radius"]').forEach((dot, j) =>
        run(dot, [{ transform: 'translateY(-50%) scale(0)', opacity: 0 }, { transform: 'translateY(-50%) scale(1)', opacity: 1 }], { duration: 700, delay: d + dur - 150 + j * 180, easing: 'cubic-bezier(.34,1.3,.64,1)' }),
      )
    })
    ;(Array.from(slide.querySelectorAll('span')) as HTMLElement[])
      .filter((s) => s.style.transform === 'rotate(45deg)' && s.style.position === 'absolute')
      .forEach((s) => {
        const p = s.parentElement as HTMLElement
        const col = parseInt(p.style.gridColumnStart || p.style.gridColumn, 10) || 2
        run(s, [{ transform: 'rotate(45deg) scale(0)', opacity: 0 }, { transform: 'rotate(45deg) scale(1)', opacity: 1 }], { duration: 800, delay: 1900 + col * 120, easing: 'cubic-bezier(.34,1.3,.64,1)' })
      })

    // chips de descuento y precios tachados
    ;(Array.from(slide.querySelectorAll('span')) as HTMLElement[])
      .filter((s) => s.textContent?.trim() === '−15%' && s.style.background)
      .forEach((s, k) => run(s, [{ transform: 'scale(.4)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], { duration: 700, delay: 1400 + k * 90, easing: 'cubic-bezier(.34,1.56,.64,1)' }))
    ;(Array.from(slide.querySelectorAll('span')) as HTMLElement[])
      .filter((s) => s.style.textDecoration && s.style.textDecoration.includes('line-through'))
      .forEach((s) => run(s, [{ opacity: 1 }, { opacity: getComputedStyle(s).opacity }], { duration: 1200, delay: 1500 }))

    // cifras que suben desde cero
    const re = /^(\d{1,3}(?:\.\d{3})+|\d+)(,\d+)?$/
    const walker = document.createTreeWalker(slide, NodeFilter.SHOW_TEXT)
    const nodes: Text[] = []
    while (walker.nextNode()) {
      const n = walker.currentNode as Text
      const t = (n.nodeValue || '').trim()
      if (!re.test(t) || !n.parentElement) continue
      const fs = parseFloat(getComputedStyle(n.parentElement).fontSize)
      if (fs < 22 || /line-through/.test(n.parentElement.style.textDecoration || '')) continue
      if (/^0\d$/.test(t)) continue
      nodes.push(n)
    }
    nodes.forEach((n) => {
      const orig = n.nodeValue || ''
      const t = orig.trim()
      const lead = orig.slice(0, orig.indexOf(t))
      const trail = orig.slice(orig.indexOf(t) + t.length)
      const [ip, dp] = t.split(',')
      const dec = dp ? dp.length : 0
      const target = parseFloat(ip.replace(/\./g, '') + (dp ? '.' + dp : ''))
      const grouped = ip.includes('.') || target >= 10000
      const fmt = (v: number) => {
        const s = v.toFixed(dec)
        let [a, b] = s.split('.')
        if (grouped) a = a.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
        return lead + a + (b ? ',' + b : '') + trail
      }
      const delay = delayFor(n.parentElement) + 250
      const dur = Math.min(2600, 1600 + Math.log10(target + 1) * 180)
      const pe = n.parentElement!
      const prevNum = pe.style.fontVariantNumeric
      pe.style.fontVariantNumeric = 'tabular-nums'
      let raf = 0
      let start: number | null = null
      let finished = false
      let last = ''
      const done = () => {
        if (finished) return
        finished = true
        cancelAnimationFrame(raf)
        n.nodeValue = orig
        pe.style.fontVariantNumeric = prevNum
      }
      n.nodeValue = fmt(0)
      const ease = (p: number) => (p < 1 ? 1 - Math.pow(1 - p, 4) : 1)
      const step = (ts: number) => {
        if (finished) return
        if (start === null) start = ts + delay
        const p = Math.min(1, Math.max(0, (ts - start) / dur))
        const v = fmt(target * ease(p))
        if (v !== last) { n.nodeValue = v; last = v }
        if (p < 1) raf = requestAnimationFrame(step)
        else done()
      }
      raf = requestAnimationFrame(step)
      remates.push({ finish: done })
    })
  }
}
