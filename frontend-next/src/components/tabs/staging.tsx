import Image from 'next/image';
import { BasicTab } from "./basic";
import check from "../../../public/icons/check.png";
import "./world-creation.css";
import { playSoftClick2 } from "../utils/sounds";

export const StagingPixelsTab = (props: any) => {
  // TODO: Style scrollbar better
  return (
    <BasicTab title={null} {...props} style={{ marginBottom: "0.5rem" }} onClose={props.clearPixelSelection} hideClose={true}>
      <div className="flex flex-row items-center justify-between w-full gap-[1rem]">
        <div className="flex flex-row items-center justify-left overflow-x-auto flex-grow
          gap-[0.4rem] px-2 py-1 border-2 border-[#00000030] rounded-[1rem] shadow-[0.5rem]">
          {props.stagingPixels.slice(0).reverse().map((pixel: any, index: number) => (
            <div
              key={index}
              className={`w-[3rem] h-[3rem] rounded-[1rem] border-2 border-[#00000070] shadow-[0.5rem] flex-shrink-0 WorldCreation__color relative ${props.isSubmittingPixels ? 'opacity-50 pointer-events-none' : ''}`}
              style={{
                backgroundColor: `#${props.worldColors[pixel.colorId]}FF`
              }}
              onClick={() => {
                if (props.isSubmittingPixels) return;
                playSoftClick2();
                const newStagingPixels = [...props.stagingPixels];
                newStagingPixels.splice(props.stagingPixels.length - 1 - index, 1);
                props.setStagingPixels(newStagingPixels);
              }}
            >
              <p className="text-[red] Transform__center--text text-xl Text__shadow--lg hidden">X</p>
            </div>
          ))}
        </div>
        <div className="flex flex-row items-center justify-center gap-[0.5rem]">
          {props.isSubmittingPixels ? (
            <div className="w-[4.5rem] h-[3rem] flex flex-col items-center justify-center">
              <div className="w-[1.2rem] h-[1.2rem] border-[2px] border-[#636569] border-t-[#F4B728] rounded-full animate-spin"></div>
              <p className="text-[0.5rem] text-[#F4B728] mt-[0.15rem]">Shielding</p>
            </div>
          ) : (
            <>
              <button className="Button__circle Text__medium size-max" onClick={() => {
                playSoftClick2();
                props.commitStagingPixels();
              }}>
                <Image alt="submit" src={check} className="w-[1.6rem] h-[1.6rem]" width={16} height={16} />
              </button>
              <button className="Button__circle Text__medium" onClick={() => {
                playSoftClick2();
                props.setStagingPixels([]);
              }}>X</button>
            </>
          )}
        </div>
      </div>
    </BasicTab>
  );
}
