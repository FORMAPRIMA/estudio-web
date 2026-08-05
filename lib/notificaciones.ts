// Destinatarios de los avisos internos por email (Resend).
//
// Vive fuera de los ficheros 'use server' a propósito: un módulo con
// 'use server' solo puede exportar funciones async, y esta lista la necesitan
// dos acciones distintas (envío de contacto y avisos de parciales).
// Solo se importa desde servidor, así que no acaba en el bundle del navegador.

/** Leads de la web: los atiende Ana (biz dev); contacto@ queda como buzón del estudio. */
export const LEADS_TO = ['aalban@formaprima.es', 'contacto@formaprima.es']
