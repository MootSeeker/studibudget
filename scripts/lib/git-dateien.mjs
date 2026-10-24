/** Gemeinsame Dateiliste für die Leitplanken- und Planprüfung. */
export function neueDateien(git) {
  return git('ls-files', '--others', '--exclude-standard', '-z').stdout.split('\0').filter(Boolean)
}

export function geaenderteDateien(git) {
  const basis = git('merge-base', 'main', 'HEAD').stdout.trim()
  const geaendert = basis ? git('diff', '--name-only', '-z', basis).stdout.split('\0') : []
  return [...new Set([...geaendert, ...neueDateien(git)].filter(Boolean))]
}
