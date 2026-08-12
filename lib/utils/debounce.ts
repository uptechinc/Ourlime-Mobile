export function debounce<TArgs extends unknown[]>(
    func: (...args: TArgs) => void,
    delay: number
): (...args: TArgs) => void {
    let timeoutId: NodeJS.Timeout;
    return (...args: TArgs) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func(...args), delay);
    };
}
