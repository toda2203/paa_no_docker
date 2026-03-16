// Template-Replace-Funktion für E-Mail-Templates
// Ersetzt alle Platzhalter mit den passenden Werten

export type TemplatePlaceholders = {
  Vorname: string;
  Nachname: string;
  tenant_name: string;
  absender_vorname: string;
  absender_nachname: string;
  absender_mail: string;
  date_time?: string;
  tracking_url?: string;
};

export function replaceTemplatePlaceholders(template: string, values: TemplatePlaceholders): string {
  // Format für date_time
  if (!values.date_time) {
    values.date_time = new Date().toLocaleString('de-DE', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  // Platzhalter ersetzen
  return template
    .replace(/{{Vorname}}/g, values.Vorname)
    .replace(/{{Nachname}}/g, values.Nachname)
    .replace(/{{tenant_name}}/g, values.tenant_name)
    .replace(/{{absender_vorname}}/g, values.absender_vorname)
    .replace(/{{absender_nachname}}/g, values.absender_nachname)
    .replace(/{{absender_mail}}/g, values.absender_mail)
    .replace(/{{date_time}}/g, values.date_time)
    .replace(/{{tracking_url}}/g, values.tracking_url || '');
}
