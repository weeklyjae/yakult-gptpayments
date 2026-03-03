// Whitelisted email addresses for Yakult GPT Payments
// Edit this list with the exact Google account emails that are allowed to use the app.
// All emails are compared in lowercase.

const WHITELISTED_EMAILS = [
    // 'jhonmartin.abonalla.cics@ust.edu.ph',
    'jhonmartinabonalla@gmail.com',
  'ravin.agon.cics@ust.edu.ph',
  'ralphlorenz.bonifacio.cics@ust.edu.ph',
  'laurenznicolo.briones.cics@ust.edu.ph',
  'altheaerica.candido.cics@ust.edu.ph',
  'carlosmiguel.delacruz.cics@ust.edu.ph',
  'janellemerini.dingding.cics@ust.edu.ph',
  'maryshea.ella.cics@ust.edu.ph',
  'jerichomiguel.junio.cics@ust.edu.ph',
  'franzlester.medina.cics@ust.edu.ph',
  'annamarisse.nilo.cics@ust.edu.ph',
  'olimardominic.olila.cics@ust.edu.ph',
  'juliannemuriel.pena.cics@ust.edu.ph',
  'pocholoenrique.pinano.cics@ust.edu.ph',
  'margaretcrystal.xavier.cics@ust.edu.ph',
]

// Admin accounts (will see the admin dashboard). You can change this list.
export const ADMIN_EMAILS = ['jhonmartin.abonalla.cics@ust.edu.ph']

// Final whitelist = regular whitelisted users + all admins
const NORMALIZED_WHITELIST = [...WHITELISTED_EMAILS, ...ADMIN_EMAILS]
  .map((email) => String(email).trim().toLowerCase())
  .filter(Boolean)

export default NORMALIZED_WHITELIST

