/** Opens the Lead settings panel from anywhere on the Leads page (toolbar, toasts, banners). */
export const LEAD_SETTINGS_EVENT = 'sts-lead-settings'

export function openLeadSettings() {
  window.dispatchEvent(new Event(LEAD_SETTINGS_EVENT))
}
