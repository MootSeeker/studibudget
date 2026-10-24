type Git = (...argumente: string[]) => { stdout: string }
export function neueDateien(git: Git): string[]
export function geaenderteDateien(git: Git): string[]
