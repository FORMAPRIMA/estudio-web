export interface Subcapitulo {
  id: string
  nombre: string
}

export interface Capitulo {
  id: string
  numero: number
  nombre: string
  subcapitulos: Subcapitulo[]
}

export type Presupuesto = Capitulo[]
