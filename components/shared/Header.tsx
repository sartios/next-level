'use client';

import { Button } from '@/components/ui/button';
import { Sheet, SheetTrigger, SheetContent, SheetClose, SheetTitle } from '@/components/ui/sheet';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { Menu } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { label: 'Schedule', href: '/schedule' },
  { label: 'Goal', href: '/goal' },
  { label: 'Challenges', href: '/challenges' }
];

const Header = () => {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-50 w-full bg-[#fff0ef]/90 backdrop-blur px-4 md:px-6 py-4">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <Link
          href="/"
          className="text-foreground font-black text-2xl focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 rounded hover:opacity-80 transition-opacity cursor-pointer bg-transparent border-0 p-0"
        >
          Next<span className="text-accent">Level</span>
        </Link>
        <div className="flex gap-6 items-center">
          {/* Desktop / large screens */}
          <div className="hidden md:flex gap-6 items-center">
            {navItems.map((item) => (
              <Button
                key={item.href}
                variant="ghost"
                asChild
                className={`font-medium text-base min-h-14 focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 ${
                  pathname === item.href ? 'text-accent' : 'text-foreground'
                }`}
              >
                <Link href={item.href}>{item.label}</Link>
              </Button>
            ))}
          </div>

          {/* Mobile / Tablet: burger menu */}
          <div className="md:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" className="p-2.5">
                  <Menu className="size-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right">
                <VisuallyHidden>
                  <SheetTitle>Navigation Menu</SheetTitle>
                </VisuallyHidden>
                <div className="flex flex-col gap-2 pt-16 bg-[#fff0ef]/50 h-full">
                  {navItems.map((item) => (
                    <SheetClose key={item.href} asChild>
                      <Link
                        href={item.href}
                        className={`text-lg font-medium py-3 px-4 rounded hover:bg-muted ${pathname === item.href ? 'text-accent' : 'text-foreground'}`}
                      >
                        {item.label}
                      </Link>
                    </SheetClose>
                  ))}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Header;
