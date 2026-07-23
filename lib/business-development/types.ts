// Tipos de Business Development. El objeto de empresa es un JSON anidado y rico;
// se mantiene deliberadamente abierto (index signature) porque el motor y las vistas
// portadas leen y escriben muchas subclaves dinámicas.

export type BdCompany = {
  id: string
  empresa: string
  pais: string
  ciudad?: string
  region?: string
  zona?: string
  perfilPrincipal: string
  scores: Record<string, number>
  gov?: Record<string, any>
  pipeline?: Record<string, any>
  contacto?: Record<string, any>
  research?: Record<string, any>
  fit?: Record<string, any>
  [k: string]: any
}

export type BdWeeklyLogEntry = {
  id: string
  date?: string
  empresa?: string
  empresaId?: string
  text?: string
  status?: string
  scoreBefore?: number
  scoreAfter?: number
  [k: string]: any
}

export type BdConfig = {
  ruleActive: boolean
  [k: string]: any
}

export type BusinessDevelopmentData = {
  companies: BdCompany[]
  wlog: BdWeeklyLogEntry[]
  config: BdConfig
}
