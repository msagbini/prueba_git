// TODO: replace with Grace's real WhatsApp number before launch, in
// international format with no spaces or leading zero (e.g. Australian
// mobile 04XX XXX XXX -> "614XXXXXXXX").
export const WHATSAPP_NUMBER = "61400000000";
export const WHATSAPP_MESSAGE =
  "Hi! I'd like to ask about a custom order from Made with Grace.";

export function getWhatsAppLink() {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`;
}
