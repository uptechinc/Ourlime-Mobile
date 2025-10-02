// utils/itemUtil.ts

// Add an item to a list and clear the new item field
export const addItem = (
    item: string,
    items: string[],
    setItems: (items: string[]) => void,
    setNewItem: (item: string) => void
) => {
    if (item.trim()) {
        setItems([...items, item.trim()]);
        setNewItem('');
    }
};

// Remove an item from a list
export const removeItem = (
    index: number,
    items: string[],
    setItems: (items: string[]) => void
) => {
    setItems(items.filter((_, i) => i !== index));
};
