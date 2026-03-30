export function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[äàâá]/g, "a")
    .replace(/[éèêë]/g, "e")
    .replace(/[îïí]/g, "i")
    .replace(/[öôó]/g, "o")
    .replace(/[üùû]/g, "u")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
