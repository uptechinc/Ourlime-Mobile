import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface UnmountProps {
  children: React.ReactNode;
  containerId?: string;
}

/**
 * Unmount component that renders its children at the root level of the DOM
 * to ensure they appear outside of their parent component hierarchy.
 * 
 * @param {React.ReactNode} children - The content to render in the portal
 * @param {string} containerId - Optional container ID (default: 'portal-container')
 * @returns Portal component or null if not mounted yet
 * 
 * @example
 * // Basic usage
 * <Unmount>
 *   <YourModalComponent />
 * </Unmount>
 */
export const Unmount: React.FC<UnmountProps> = ({ 
  children, 
  containerId = 'portal-container' 
}) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Don't render anything until component is mounted (prevents SSR issues)
  if (!mounted || typeof document === 'undefined') return null;

  // Get or create container element
  let container = document.getElementById(containerId);
  if (!container) {
    container = document.createElement('div');
    container.id = containerId;
    document.body.appendChild(container);
  }

  return createPortal(children, container);
};

export default Unmount;
