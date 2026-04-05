export interface Partida {
  id: string
  concepto: string
  descripcion: string
  unidad: string
  cantidad: number
  precioUnitario: number
}

export interface Subcapitulo {
  id: string
  nombre: string
  partidas: Partida[]
}

export interface Capitulo {
  id: string
  numero: number
  nombre: string
  subcapitulos: Subcapitulo[]
}

export type Presupuesto = Capitulo[]
