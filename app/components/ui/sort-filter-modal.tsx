"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";

// Define the option type
export type SortFilterOption = {
  id: string;
  label: string;
  selected?: boolean;
};

type SortFilterModalProps = {
  title: string;
  options: SortFilterOption[];
  isOpen: boolean;
  onClose: () => void;
  onReset: () => void;
  onSelect: (optionId: string) => void;
  onDone: () => void;
};

export function SortFilterModal({
  title,
  options,
  isOpen,
  onClose,
  onReset,
  onSelect,
  onDone
}: SortFilterModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="p-0 gap-0 max-w-[360px] rounded-xl border-0 shadow-xl">
        {/* Modal header */}
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <div className="font-medium">{title}</div>
          <button 
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded-full text-gray-500 hover:text-gray-700"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
            <span className="sr-only">Close</span>
          </button>
        </div>
        
        {/* Modal content */}
        <div className="py-2">
          {options.map((option) => (
            <div 
              key={option.id}
              className="px-4 py-3 flex items-center justify-between hover:bg-gray-50 cursor-pointer"
              onClick={() => onSelect(option.id)}
            >
              <span className="text-sm">{option.label}</span>
              {option.selected && (
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  width="18" 
                  height="18" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                  className="text-green-600"
                >
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              )}
            </div>
          ))}
        </div>
        
        {/* Modal footer */}
        <div className="border-t p-3 flex gap-2">
          <Button 
            variant="outline" 
            className="flex-1 bg-gray-50 hover:bg-gray-100 border-gray-200 text-gray-800"
            onClick={onReset}
          >
            Reset
          </Button>
          <Button
            className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white"
            onClick={onDone}
          >
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Example usage:
// 
// const [isModalOpen, setIsModalOpen] = useState(false);
// const [sortOptions, setSortOptions] = useState([
//   { id: 'arrival', label: 'Arrival Time' },
//   { id: 'departure', label: 'Departure Time', selected: true },
//   { id: 'price', label: 'Lowest Fare' },
//   { id: 'duration', label: 'Duration' },
//   { id: 'nonstop', label: 'Non-Stop' },
// ]);
//
// const handleSelect = (optionId) => {
//   setSortOptions(options => options.map(option => ({
//     ...option,
//     selected: option.id === optionId
//   })));
// };
//
// const handleReset = () => {
//   setSortOptions(options => options.map(option => ({
//     ...option,
//     selected: false
//   })));
// };
//
// return (
//   <>
//     <Button onClick={() => setIsModalOpen(true)}>Sort by</Button>
//     <SortFilterModal
//       title="Sort flights by"
//       options={sortOptions}
//       isOpen={isModalOpen}
//       onClose={() => setIsModalOpen(false)}
//       onReset={handleReset}
//       onSelect={handleSelect}
//       onDone={() => setIsModalOpen(false)}
//     />
//   </>
// ); 