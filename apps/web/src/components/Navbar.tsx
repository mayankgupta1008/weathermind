import logo from "@/assets/logo.png";
import { Link } from "react-router-dom";

const Navbar = () => {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-black/20 dark:border-white/30 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between px-4 md:px-6 mx-auto max-w-7xl">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <Link to="/" className="flex items-center gap-2">
            <img
              src={logo}
              alt="Description"
              className="w-10 h-10 object-contain"
            />
            <span className="font-bold sm:inline-block">Weather Agent</span>
          </Link>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
