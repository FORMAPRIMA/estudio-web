// Modelo de cláusulas editables del contrato de servicios profesionales.
//
// Las cláusulas "boilerplate" (obligaciones, duración, resolución, propiedad
// intelectual, etc.) dejan de estar hardcodeadas en el PDF y pasan a ser datos
// estructurados editables: por contrato (snapshot en contrato.contenido.clausulas)
// y, en una fase posterior, desde una plantilla de origen.
//
// Las secciones de DATOS del contrato (partes, manifiestan, alcance de servicios,
// criterio de honorarios, tabla de pagos, firmas) NO viven aquí: siguen generándose
// dinámicamente en ContratoPDF.tsx a partir de los datos del contrato.

import { PRECIO_HORA } from '@/lib/propuestas/config'

// ── Tipos ───────────────────────────────────────────────────────────────────

/**
 * 'clausula'    → cláusula numerada de primer nivel (recibe ordinal: Tercera, Cuarta…)
 * 'subclausula' → apartado dentro de Honorarios (Modificaciones, Forma de pago…), sin ordinal
 */
export type ClausulaNivel = 'clausula' | 'subclausula'

/** Un bloque de contenido dentro de una cláusula. */
export interface ClausulaBloque {
  tipo: 'parrafo' | 'lista'
  /** Para 'parrafo'. Admite **negrita** inline y tokens {{precio_senior}}. */
  texto?: string
  /** Para 'lista'. Se renderiza con sub-apartados a. b. c. */
  items?: string[]
}

export interface ContratoClausula {
  /** Identificador estable. Las custom añadidas usan 'custom-<n>'. */
  key: string
  nivel: ClausulaNivel
  titulo_es: string
  titulo_en: string
  bloques_es: ClausulaBloque[]
  bloques_en: ClausulaBloque[]
  /** Cláusula sensible (PI, responsabilidad, confidencialidad…): avisa antes de editar. */
  es_nucleo?: boolean
  /** Si está presente, la cláusula solo se renderiza si el contrato incluye ese servicio (id). */
  condicion?: string | null
}

// ── Ordinales ─────────────────────────────────────────────────────────────────

const ORDINALES_ES = [
  '', 'Primera', 'Segunda', 'Tercera', 'Cuarta', 'Quinta', 'Sexta', 'Séptima',
  'Octava', 'Novena', 'Décima', 'Undécima', 'Duodécima', 'Decimotercera',
  'Decimocuarta', 'Decimoquinta', 'Decimosexta', 'Decimoséptima', 'Decimoctava',
  'Decimonovena', 'Vigésima',
]

const ORDINALES_EN = [
  '', 'First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh',
  'Eighth', 'Ninth', 'Tenth', 'Eleventh', 'Twelfth', 'Thirteenth', 'Fourteenth',
  'Fifteenth', 'Sixteenth', 'Seventeenth', 'Eighteenth', 'Nineteenth', 'Twentieth',
]

export function ordinal(n: number, lang: 'es' | 'en'): string {
  const arr = lang === 'en' ? ORDINALES_EN : ORDINALES_ES
  return arr[n] ?? `${n}.`
}

// ── Tokens de interpolación ─────────────────────────────────────────────────

const TOKENS: Record<string, string> = {
  precio_junior: String(PRECIO_HORA.junior),
  precio_senior: String(PRECIO_HORA.senior),
  precio_socio:  String(PRECIO_HORA.socio),
}

/** Sustituye {{precio_junior}}, {{precio_senior}}, {{precio_socio}} por su valor. */
export function interpolarTokens(texto: string): string {
  return texto.replace(/\{\{(\w+)\}\}/g, (m, k) => TOKENS[k] ?? m)
}

// ── Seed con el texto legal actual ─────────────────────────────────────────────

export const CLAUSULAS_DEFAULT: ContratoClausula[] = [
  // ── Sub-apartados de la cláusula Honorarios ──────────────────────────────
  {
    key: 'modificaciones',
    nivel: 'subclausula',
    titulo_es: 'Modificaciones',
    titulo_en: 'Modifications',
    bloques_es: [
      { tipo: 'parrafo', texto: 'El Cliente podrá proponer cambios a los trabajos en el plazo de una (1) semana desde su presentación, período tras el cual se considerarán aprobados. Todo cambio solicitado por el Cliente una vez entregado cada servicio se considerará parte del siguiente.' },
      { tipo: 'parrafo', texto: 'Las alteraciones sustanciales que sean peticiones expresas del Cliente, una vez aprobado el trabajo correspondiente, serán objeto de honorarios adicionales pactados previamente con base al precio horario del Estudio (Arquitecto Junior {{precio_junior}}€/h + IVA / Arquitecto Senior {{precio_senior}}€/h + IVA / Arquitecto Socio {{precio_socio}}€/h + IVA), las cuales se facturarán una vez realizadas las alteraciones. Se considerarán alteraciones sustanciales las que impliquen un cambio de concepto, modificaciones por parte de otros técnicos en estructuras o instalaciones que supongan una alteración sustancial, una carga de trabajo imprevista, la realización de dibujos para atender solicitaciones del constructor a soluciones constructivas distintas a las fijadas en la memoria de calidades, la incorporación de aportaciones de terceros y la realización de visitas de obra fuera del plazo marcado por el cronograma.' },
    ],
    bloques_en: [
      { tipo: 'parrafo', texto: 'The Client may propose changes to the works within one (1) week of their presentation, after which period they shall be deemed approved. Any change requested by the Client once each service has been delivered shall be considered part of the next phase.' },
      { tipo: 'parrafo', texto: "Substantial alterations that are express requests of the Client, once the corresponding work has been approved, shall be subject to additional fees previously agreed on the basis of the Studio's hourly rate (Junior Architect {{precio_junior}}€/h + VAT / Senior Architect {{precio_senior}}€/h + VAT / Partner Architect {{precio_socio}}€/h + VAT), which shall be invoiced once the alterations have been carried out. Substantial alterations shall be understood as those involving a change of concept, modifications by other technicians in structures or installations that entail a substantial alteration, an unforeseen workload, the production of drawings to address requests from the contractor for constructive solutions other than those established in the specifications, the incorporation of third-party contributions and the performance of site visits outside the timetable set by the programme." },
    ],
  },
  {
    key: 'forma_pago',
    nivel: 'subclausula',
    titulo_es: 'Forma de pago',
    titulo_en: 'Payment terms',
    bloques_es: [
      { tipo: 'parrafo', texto: 'El Estudio elaborará, con carácter previo a cada período de vencimiento, una factura que deberá ser abonada en el plazo de quince (15) días a contar desde su emisión mediante transferencia bancaria a la cuenta que señale el Estudio.' },
      { tipo: 'parrafo', texto: 'Cualquier retraso en el pago de la factura constituirá al deudor en mora de forma automática, sin necesidad de intimación o requerimiento previo. Dicho retraso devengará, desde el día siguiente al del vencimiento y hasta la fecha de su íntegro pago, un interés de demora pactado del 3% mensual sobre el importe total de la factura impagada.' },
    ],
    bloques_en: [
      { tipo: 'parrafo', texto: 'The Studio shall issue an invoice prior to each due date, which shall be paid within fifteen (15) days of its issuance by bank transfer to the account specified by the Studio.' },
      { tipo: 'parrafo', texto: 'Any delay in payment of the invoice shall automatically place the debtor in default, without the need for prior notice or demand. Such delay shall accrue, from the day following the due date until the date of full payment, a contractually agreed default interest of 3% per month on the total amount of the unpaid invoice.' },
    ],
  },
  {
    key: 'exclusiones',
    nivel: 'subclausula',
    titulo_es: 'Exclusiones',
    titulo_en: 'Exclusions',
    bloques_es: [
      { tipo: 'parrafo', texto: 'Quedan expresamente excluidos del contrato todos los servicios no recogidos en el índice anteriormente expuesto. Con carácter enunciativo y no limitativo, se citan los siguientes: redacción de separatas al proyecto no citadas, servicios de Seguridad y Salud en cualquier fase, tramitaciones urbanísticas, tramitación de legalizaciones y boletines de instalaciones, etc.' },
    ],
    bloques_en: [
      { tipo: 'parrafo', texto: 'All services not included in the scope listed above are expressly excluded from this Agreement. By way of example and without limitation: preparation of addenda to the project not mentioned herein, Health and Safety services at any stage, urban planning procedures, legalisation procedures and utility connection certificates, etc.' },
    ],
  },

  // ── Cláusulas numeradas (ordinal automático desde la Tercera) ─────────────
  {
    key: 'obligaciones_estudio',
    nivel: 'clausula',
    es_nucleo: true,
    titulo_es: 'Obligaciones del Estudio',
    titulo_en: 'Obligations of the Studio',
    bloques_es: [
      { tipo: 'lista', items: [
        'El Estudio se obliga a realizar los servicios contratados con la máxima diligencia, colaborando con contratistas externos para que los trabajos se lleven a cabo de conformidad con lo que las partes acuerden.',
        'El Estudio se obliga a informar al Cliente de los avances en sus trabajos.',
        'El Estudio será responsable de los daños directos probados con un máximo de los honorarios previstos para la fase en la que se haya producido el incumplimiento, quedando su responsabilidad limitada a dicha cantidad y exenta de cualquier otra. El Estudio no será responsable por daños indirectos, incidentales, especiales, punitivos o consecuentes o de terceros, ni de trabajos que no formen parte de este encargo.',
        'En caso en que el Estudio se retrase en la entrega del servicio contratado al Cliente por causas únicamente imputables al Estudio, éste tendrá derecho a aplicar una penalización del 1% de los Honorarios correspondientes a dicha entrega por cada día natural de retraso.',
      ] },
    ],
    bloques_en: [
      { tipo: 'lista', items: [
        'The Studio undertakes to perform the contracted services with the utmost diligence, collaborating with external contractors so that the works are carried out in accordance with what the parties agree.',
        'The Studio undertakes to keep the Client informed of progress in its work.',
        'The Studio shall be liable for proven direct damages up to a maximum of the fees corresponding to the phase in which the breach occurred, its liability being limited to that amount and exempt from any other. The Studio shall not be liable for indirect, incidental, special, punitive or consequential damages, or for damages suffered by third parties, nor for works that do not form part of this commission.',
        'In the event that the Studio delays delivery of the contracted service to the Client for reasons solely attributable to the Studio, the Client shall be entitled to apply a penalty of 1% of the Fees corresponding to such delivery for each calendar day of delay.',
      ] },
    ],
  },
  {
    key: 'obligaciones_cliente',
    nivel: 'clausula',
    titulo_es: 'Obligaciones del Cliente',
    titulo_en: 'Obligations of the Client',
    bloques_es: [
      { tipo: 'lista', items: [
        'Condición de Promotor y Titularidad. El Cliente ostenta la condición legal de Promotor a los efectos de la Ley 38/1999, de 5 de noviembre, de Ordenación de la Edificación (LOE) y de la normativa urbanística aplicable. Como tal, es el único titular y responsable de todas las gestiones, obligaciones y cargas inherentes a dicha condición.',
        'Es obligación exclusiva e indelegable del Cliente-Promotor solicitar, gestionar y obtener a su costa, con carácter previo al inicio de cualquier actuación material, el título habilitante urbanístico que resulte preceptivo ante cualquier Administración para la ejecución de la obra objeto del presente Contrato.',
        'El Estudio queda plenamente exonerado de cualquier responsabilidad por las decisiones finales sobre las soluciones a adoptar en el proyecto y su ejecución, correspondientes al Cliente en su condición de promotor. En ejercicio de dicha potestad, el Cliente asume como propia y exclusiva la responsabilidad final frente a la Administración y a terceros por las características de la obra efectivamente ejecutada.',
        'El Cliente se obliga a abonar las cantidades pactadas en el presente contrato y de la forma acordada.',
        'El Cliente se obliga a colaborar en todo lo necesario con el Estudio para el buen desarrollo de los servicios contratados.',
      ] },
    ],
    bloques_en: [
      { tipo: 'lista', items: [
        'Developer status and ownership. The Client holds the legal status of Developer for the purposes of Law 38/1999 of 5 November on Building Regulation (LOE) and the applicable urban planning regulations. As such, the Client is the sole holder and responsible party for all management, obligations and burdens inherent to that status.',
        'It is the exclusive and non-delegable obligation of the Client-Developer to apply for, manage and obtain at its own cost, prior to the commencement of any physical works, the urban planning authorisation required by any competent Authority for the execution of the works that are the subject of this Agreement.',
        'The Studio is fully exempt from any liability for the final decisions regarding the solutions to be adopted in the project and its execution, which correspond to the Client in its capacity as developer. In exercising this power, the Client assumes sole and exclusive final responsibility before the Administration and third parties for the characteristics of the works actually carried out.',
        'The Client undertakes to pay the amounts agreed in this Agreement in the manner agreed.',
        'The Client undertakes to cooperate in all matters necessary with the Studio for the proper performance of the contracted services.',
      ] },
    ],
  },
  {
    key: 'duracion',
    nivel: 'clausula',
    titulo_es: 'Duración',
    titulo_en: 'Duration',
    bloques_es: [
      { tipo: 'parrafo', texto: 'Los servicios acordados en el contrato comenzarán a la firma del mismo y tendrán terminación con fecha el cronograma de obra fijado en el contrato privado entre Constructor y Propiedad.' },
      { tipo: 'parrafo', texto: 'El Estudio, en caso de ser necesario, realizará tareas de seguimiento de posibles repasos y desperfectos de obra por parte del constructor durante dos (2) semanas tras la recepción de la obra por parte del Cliente.' },
    ],
    bloques_en: [
      { tipo: 'parrafo', texto: 'The services agreed in this Agreement shall commence upon its signing and shall terminate on the date set by the construction programme established in the private contract between the Contractor and the Owner.' },
      { tipo: 'parrafo', texto: 'The Studio shall, if necessary, carry out monitoring of any snagging and construction defects by the contractor during two (2) weeks following handover of the works by the Client.' },
    ],
  },
  {
    key: 'resolucion',
    nivel: 'clausula',
    es_nucleo: true,
    titulo_es: 'Resolución del contrato',
    titulo_en: 'Termination',
    bloques_es: [
      { tipo: 'parrafo', texto: 'El presente Contrato se terminará:' },
      { tipo: 'lista', items: [
        'Por transcurso de su plazo de duración.',
        'Por mutuo acuerdo por escrito de las partes, que podrán decidir su resolución total o parcial.',
        'Por cualquiera de las partes, en el supuesto de que la otra parte incumpla cualquiera de sus obligaciones derivadas del Contrato. En caso de que la obligación fuera subsanable, la Parte no incumplidora deberá notificar previamente por escrito a la otra Parte dicho incumplimiento, requiriéndole para que sea subsanado en un plazo de 10 días desde la recepción de la notificación.',
        'Por incumplimiento de órdenes del Estudio al Constructor en la Dirección Estética de Obra, debidamente notificados al Cliente. Se entenderá como incumplimiento de las órdenes cuando no se hayan seguido las instrucciones en tres (3) ocasiones, notificadas en las actas de visita.',
        'El Estudio podrá renunciar a la obra de forma unilateral en caso en que la obra se haya paralizado durante más de tres (3) meses por causas ajenas a él.',
        'La falta de pago por el Cliente del precio del Contrato en la forma y plazos pactados.',
        'El Cliente podrá rescindir el contrato en caso de un retraso superior a cuatro (4) semanas en cualquiera de los servicios objeto del contrato, por causas directa y exclusivamente imputables al Arquitecto. Quedan excluidas las causas de fuerza mayor.',
      ] },
      { tipo: 'parrafo', texto: 'En caso de resolución del Contrato y una vez satisfechas las cantidades pactadas, el Estudio quedará obligado a dejar firmada la correspondiente Venia y facilitar toda la documentación al Arquitecto/Interiorista entrante en el acto del abono de la liquidación.' },
      { tipo: 'parrafo', texto: 'En caso de producirse la rescisión del contrato por parte del Cliente, éste se verá obligado a abonar el 100% de los honorarios hasta la fase en la que se haya producido la rescisión, así como el 30% de los honorarios restantes correspondientes a las fases dejadas de realizar por parte del Estudio en concepto de indemnización.' },
    ],
    bloques_en: [
      { tipo: 'parrafo', texto: 'This Agreement shall be terminated:' },
      { tipo: 'lista', items: [
        'Upon expiry of its term.',
        'By mutual written agreement of the parties, who may decide its total or partial termination.',
        'By either party, in the event that the other party breaches any of its obligations under this Agreement. If the breach is remediable, the non-breaching Party shall first give written notice to the other Party of such breach, requiring it to remedy the same within 10 days of receipt of the notification.',
        "Due to non-compliance with the Studio's instructions to the Contractor in the Aesthetic Construction Management, duly notified to the Client. Non-compliance with instructions shall be deemed to occur when the instructions have not been followed on three (3) occasions, as recorded in the site visit reports.",
        'The Studio may unilaterally withdraw from the works in the event that the works have been suspended for more than three (3) months for reasons beyond its control.',
        'Failure by the Client to pay the price under this Agreement in the manner and within the periods agreed.',
        'The Client may terminate this Agreement in the event of a delay of more than four (4) weeks in any of the services that are the subject of this Agreement, for reasons directly and exclusively attributable to the Architect. Force majeure events are excluded.',
      ] },
      { tipo: 'parrafo', texto: 'In the event of termination of this Agreement and once the agreed amounts have been settled, the Studio shall be obliged to sign the corresponding professional transfer document and provide all documentation to the incoming Architect/Interior Designer at the time of payment of the settlement.' },
      { tipo: 'parrafo', texto: 'In the event of termination of this Agreement by the Client, the Client shall be obliged to pay 100% of the fees up to the phase in which the termination occurred, as well as 30% of the remaining fees corresponding to the phases not performed by the Studio, as compensation.' },
    ],
  },
  {
    key: 'propiedad_intelectual',
    nivel: 'clausula',
    es_nucleo: true,
    titulo_es: 'Propiedad intelectual',
    titulo_en: 'Intellectual property',
    bloques_es: [
      { tipo: 'parrafo', texto: 'El ESTUDIO se reserva todos los derechos de propiedad intelectual sobre el proyecto, incluyendo, pero sin limitarse a, los planos, diseños, imágenes, modelados en 3D, documentación técnica y cualquier otro material generado en el desarrollo del mismo, conforme a lo dispuesto en la Ley de Propiedad Intelectual de España.' },
      { tipo: 'parrafo', texto: 'El trabajo realizado por el Estudio, una vez abonados los honorarios correspondientes, podrá ser utilizado por el Cliente una sola vez, única y exclusivamente para la ubicación consignada en este encargo, correspondiendo al Estudio los derechos inherentes a la propiedad intelectual. El Estudio podrá realizar reportaje fotográfico del Proyecto terminado y publicarlo con fines corporativos, docentes y de comunicación junto a la planimetría, manteniendo en cualquier caso la confidencialidad del Cliente y la ubicación exacta.' },
      { tipo: 'parrafo', texto: 'Queda expresamente prohibida la reproducción, modificación, cesión o utilización de la documentación para cualquier otro fin o en otra ubicación sin el consentimiento expreso y por escrito del Estudio.' },
    ],
    bloques_en: [
      { tipo: 'parrafo', texto: 'The STUDIO reserves all intellectual property rights over the project, including but not limited to plans, designs, images, 3D models, technical documentation and any other material generated in the course of its development, in accordance with Spanish Intellectual Property Law.' },
      { tipo: 'parrafo', texto: 'The work performed by the Studio, once the corresponding fees have been paid, may be used by the Client on one single occasion, solely and exclusively for the location specified in this commission, with the intellectual property rights remaining with the Studio. The Studio may carry out photographic documentation of the completed Project and publish it for corporate, educational and communication purposes together with the drawings, while in any case maintaining the confidentiality of the Client and the exact location.' },
      { tipo: 'parrafo', texto: 'The reproduction, modification, assignment or use of the documentation for any other purpose or at any other location is expressly prohibited without the express written consent of the Studio.' },
    ],
  },
  {
    key: 'seguros',
    nivel: 'clausula',
    es_nucleo: true,
    titulo_es: 'Seguros',
    titulo_en: 'Insurance',
    bloques_es: [
      { tipo: 'parrafo', texto: 'El Estudio se obliga a mantener en vigor por su cuenta y a su cargo una póliza de seguro de responsabilidad civil que cubra las posibles contingencias que se pudieran derivar de la prestación de los servicios. Las partes acuerdan que la responsabilidad del Estudio queda limitada a los honorarios previstos para la fase en la que se haya producido el incumplimiento.' },
    ],
    bloques_en: [
      { tipo: 'parrafo', texto: "The Studio undertakes to maintain in force at its own cost a professional liability insurance policy covering any contingencies that may arise from the provision of the services. The parties agree that the Studio's liability is limited to the fees corresponding to the phase in which the breach occurred." },
    ],
  },
  {
    key: 'confidencialidad',
    nivel: 'clausula',
    es_nucleo: true,
    titulo_es: 'Confidencialidad y protección de datos',
    titulo_en: 'Confidentiality and data protection',
    bloques_es: [
      { tipo: 'parrafo', texto: 'Las Partes se comprometen a gestionar el presente encargo con ética, profesionalidad, reserva y legalidad, actuando con total lealtad y diligencia. También se obligan a velar por la confidencialidad de la información recibida, así como las que marca la Ley Orgánica 3/2018, de 5 de diciembre, de Protección de Datos Personales y garantía de los derechos digitales.' },
      { tipo: 'parrafo', texto: 'Cualquier tipo de información, oral o escrita, que pueda facilitar el Cliente se entenderá confidencial y no podrá ser divulgada a terceras partes, limitándose su acceso a los empleados autorizados que precisen disponer de ella. Esta cláusula se mantendrá en vigor de forma indefinida, aún después de extinguido el presente Contrato.' },
      { tipo: 'parrafo', texto: 'El Cliente autoriza y exime de cualquier responsabilidad al Estudio en la comunicación de datos personales con fin único y exclusivo del correcto desarrollo de los servicios contratados con terceros (proveedores, montadores, ingenieros o cualquier otro agente directamente relacionado al proceso).' },
    ],
    bloques_en: [
      { tipo: 'parrafo', texto: 'The Parties undertake to conduct this commission with ethics, professionalism, discretion and compliance with the law, acting with full loyalty and diligence. They also undertake to safeguard the confidentiality of the information received, as well as to comply with Organic Law 3/2018 of 5 December on the Protection of Personal Data and the Guarantee of Digital Rights.' },
      { tipo: 'parrafo', texto: 'Any information, whether oral or written, provided by the Client shall be treated as confidential and shall not be disclosed to third parties, access being limited to authorised employees who need it for the purposes of the commission. This clause shall remain in force indefinitely, even after this Agreement has been terminated.' },
      { tipo: 'parrafo', texto: 'The Client authorises and exempts the Studio from any liability for the communication of personal data for the sole and exclusive purpose of the proper performance of the services contracted with third parties (suppliers, fitters, engineers or any other party directly involved in the process).' },
    ],
  },
  {
    key: 'disposiciones_generales',
    nivel: 'clausula',
    titulo_es: 'Disposiciones generales',
    titulo_en: 'General provisions',
    bloques_es: [
      { tipo: 'parrafo', texto: 'Este Contrato constituye una unidad resultado del acuerdo completo entre las Partes en relación con su objeto. Todos los acuerdos suscritos por las partes de forma oral o escrita con anterioridad a su firma quedan derogados por el presente Contrato.' },
      { tipo: 'parrafo', texto: 'En el caso de que se declarase nula o inexigible cualquiera de las cláusulas del presente Contrato, su validez en conjunto no quedará afectada, permaneciendo en vigor los restantes términos y condiciones.' },
      { tipo: 'parrafo', texto: 'Para cuantas cuestiones, divergencias, interpretación o cumplimiento del presente Contrato puedan surgir entre las partes, éstas, con renuncia del fuero que pudiera corresponderles, se someten a los Juzgados y Tribunales de la ciudad de Madrid.' },
    ],
    bloques_en: [
      { tipo: 'parrafo', texto: 'This Agreement constitutes the entire agreement between the Parties in relation to its subject matter. All agreements entered into by the parties, whether oral or written, prior to its signing are superseded by this Agreement.' },
      { tipo: 'parrafo', texto: 'If any clause of this Agreement is declared null and void or unenforceable, the validity of the Agreement as a whole shall not be affected, and the remaining terms and conditions shall remain in force.' },
      { tipo: 'parrafo', texto: 'For all matters, disputes, interpretation or performance of this Agreement that may arise between the parties, both parties, waiving any other jurisdiction that may apply, submit to the Courts of the city of Madrid.' },
    ],
  },
]

// ── Helpers de snapshot / diff ─────────────────────────────────────────────────

/** Copia profunda del seed de fábrica, para inicializar la plantilla o el editor. */
export function seedClausulas(): ContratoClausula[] {
  return JSON.parse(JSON.stringify(CLAUSULAS_DEFAULT)) as ContratoClausula[]
}

/**
 * Helpers de diff. `baseline` es el conjunto de referencia:
 *   - En el editor de un contrato → la plantilla viva (para marcar lo que tocó el abogado).
 *   - En el editor de la plantilla → el seed de fábrica (CLAUSULAS_DEFAULT, por defecto).
 */

/** ¿La cláusula es custom (añadida, no existe en la baseline)? */
export function esClausulaCustom(c: ContratoClausula, baseline: ContratoClausula[] = CLAUSULAS_DEFAULT): boolean {
  return !baseline.some(d => d.key === c.key)
}

/** ¿La cláusula difiere del texto de la baseline? (false para custom) */
export function clausulaModificada(c: ContratoClausula, baseline: ContratoClausula[] = CLAUSULAS_DEFAULT): boolean {
  const base = baseline.find(d => d.key === c.key)
  if (!base) return false
  const norm = (x: ContratoClausula) => JSON.stringify([x.titulo_es, x.bloques_es, x.titulo_en, x.bloques_en])
  return norm(c) !== norm(base)
}

/** Cláusulas de la baseline que han sido eliminadas del conjunto actual. */
export function clausulasEliminadas(clausulas: ContratoClausula[], baseline: ContratoClausula[] = CLAUSULAS_DEFAULT): ContratoClausula[] {
  const present = new Set(clausulas.map(c => c.key))
  return baseline.filter(d => !present.has(d.key))
}
