import { BasicTab } from "./basic";
import { playSoftClick2 } from "../utils/sounds";

interface DeleteAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const DeleteAccountModal = ({ isOpen, onClose, onConfirm }: DeleteAccountModalProps) => {
  if (!isOpen) return null;

  const handleDelete = () => {
    playSoftClick2();
    onConfirm();
    onClose();
  };

  const handleCancel = () => {
    playSoftClick2();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70 pointer-events-auto">
      <div className="w-[90%] max-w-[500px]">
        <BasicTab title="Delete Account" hideClose={false} onClose={handleCancel}>
          <div className="flex flex-col w-full mt-[1rem] px-[1rem]">
            <div className="flex flex-col w-full mb-[2rem]">
              <p className="Text__medium text-[#D9D8D6] mb-[1rem]">
                Are you sure you want to delete this account?
              </p>
              <p className="Text__small text-[#636569]">
                This action cannot be undone. You will not be able to recover this account once deleted.
              </p>
            </div>
            <div className="flex flex-row justify-center gap-[1rem] mb-[1rem]">
              <button
                className="flex-1 px-6 py-2 text-lg font-semibold text-[#D9D8D6] bg-[#636569] rounded-xl hover:bg-[#4a4a4d]"
                onClick={handleCancel}
              >
                Cancel
              </button>
              <button
                className="flex-1 px-6 py-2 text-lg font-semibold text-white bg-[#C85050] rounded-xl hover:bg-[#a04040]"
                onClick={handleDelete}
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
