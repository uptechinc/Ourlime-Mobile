export function debounce<TArgs extends unknown[]>(
    func: (...args: TArgs) => void,
    delay: number
): (...args: TArgs) => void {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    return (...args: TArgs) => {
        if (timeoutId !== undefined) clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func(...args), delay);
    };
}
