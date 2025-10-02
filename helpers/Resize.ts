export const ResizeListener = (setIsPc: React.Dispatch<React.SetStateAction<boolean>>) => { 
    const handleResize = () => setIsPc(window.innerWidth >= 1024);
  
    handleResize(); 
    const debounceTimeout = setTimeout(() => {
      window.addEventListener('resize', handleResize);
    }, 500);
  
    return () => {
      clearTimeout(debounceTimeout);
      window.removeEventListener('resize', handleResize);
    };
  };