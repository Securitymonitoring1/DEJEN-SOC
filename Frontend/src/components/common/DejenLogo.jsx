import logo from "../../assets/images/DEJEN SOC Ethiopian Cyber Shield1.png";

export const DejenLogo = ({
  className = "",
  size = "md",
  variant = "circular-white"
}) => {
  const sizeMap = {
    sm: "w-14 h-14",
    md: "w-16 h-16",
    lg: "w-20 h-20"
  };
  const variantStyles = {
    "circular-white": "bg-transparent text-[#111315] shadow-none border-0 rounded-none",
    "dark": "bg-transparent text-white shadow-none border-0 rounded-none",
    "glass": "bg-transparent backdrop-blur-none text-[#111315] border-0 shadow-none rounded-none"
  };

  return (
    <div
      className={`flex items-center justify-center transition-transform duration-200 group-hover:scale-105 shrink-0 overflow-visible ${sizeMap[size]} ${variantStyles[variant]} ${className}`}
    >
      <img
        src={logo}
        alt="DEJEN logo"
        className="h-full w-full object-contain object-center scale-125"
      />
    </div>
  );
};
