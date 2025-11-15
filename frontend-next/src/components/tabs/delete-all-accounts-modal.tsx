import { useState } from "react";
import { BasicTab } from "./basic";
import { playSoftClick2 } from "../utils/sounds";

interface DeleteAllAccountsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

const CONFIRMATION_TEXT = "Delete all accounts";

export const DeleteAllAccountsModal = ({ isOpen, onClose, onConfirm }: DeleteAllAccountsModalProps) => {
  const [inputValue, setInputValue] = useState("");

  if (!isOpen) return null;

  const isConfirmationValid = inputValue === CONFIRMATION_TEXT;

  const handleDelete = () => {
    if (!isConfirmationValid) return;
    playSoftClick2();
    onConfirm();
    onClose();
    setInputValue(""); // Reset input
  };

  const handleCancel = () => {
    playSoftClick2();
    onClose();
    setInputValue(""); // Reset input
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 pointer-events-auto">
      <div className="w-[90%] max-w-[500px]">
        <BasicTab title="Delete All Accounts" hideClose={false} onClose={handleCancel}>
          <div className="flex flex-col w-full mt-[1rem] px-[1rem]">
            <div className="flex flex-col w-full mb-[1.5rem]">
              <p className="Text__medium text-black mb-[1rem]">
                Are you sure you want to delete ALL accounts?
              </p>
              <p className="Text__small text-gray-700 mb-[1rem]">
                This action cannot be undone. All accounts will be permanently deleted and you will not be able to recover them.
              </p>
              <p className="Text__small text-black mb-[0.5rem]">
                Type &quot;{CONFIRMATION_TEXT}&quot; to confirm:
              </p>
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={CONFIRMATION_TEXT}
                className="Input__primary Text__small w-full px-3 py-2 border-2 border-black rounded-lg focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="flex flex-row justify-center gap-[1rem] mb-[1rem]">
              <button
                className="flex-1 px-6 py-2 text-lg font-semibold text-white bg-gray-500 rounded-xl hover:bg-gray-600"
                onClick={handleCancel}
              >
                Cancel
              </button>
              <button
                className={`flex-1 px-6 py-2 text-lg font-semibold text-white rounded-xl ${
                  isConfirmationValid
                    ? "bg-red-500 hover:bg-red-600 cursor-pointer"
                    : "bg-gray-300 cursor-not-allowed opacity-50"
                }`}
                onClick={handleDelete}
                disabled={!isConfirmationValid}
              >
                Delete
              </button>
            </div>
          </div>
        </BasicTab>
      </div>
    </div>
  );
};
