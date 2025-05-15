
// This file should define and export the useToast hook directly from @radix-ui/react-toast
import { useToast as useToastFromRadix } from "@radix-ui/react-toast";

// Re-export the useToast hook from Radix UI
export const useToast = useToastFromRadix;

// Export the toast function
export function toast(props: Parameters<ReturnType<typeof useToast>['toast']>[0]) {
  return useToast().toast(props);
}
