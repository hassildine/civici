type MessageLead = {
  fullName: string;
  eventName: string;
};

export function compileMessage(template: string, lead: MessageLead) {
  const firstName = lead.fullName.trim().split(/\s+/)[0] ?? "there";
  return template
    .replaceAll("{firstName}", firstName)
    .replaceAll("{fullName}", lead.fullName)
    .replaceAll("{eventName}", lead.eventName);
}
