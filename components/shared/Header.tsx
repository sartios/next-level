'use client';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
  Drawer,
  DrawerTrigger,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerClose
} from '@/components/ui/drawer';
import { ChevronDown, LogOut, Menu, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { label: 'Schedule', href: '/schedule' },
  { label: 'Goal', href: '/goal' },
  { label: 'Insights', href: '/insights' },
  { label: 'Rewards', href: '/rewards' },
  { label: 'Achievements', href: '/achievements' }
];

const Header = () => {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-50 w-full bg-[#fff0ef]/90 backdrop-blur px-6 py-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
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
                className={`font-medium text-base min-h-11 focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 ${
                  pathname === item.href ? 'text-accent' : 'text-foreground'
                }`}
              >
                <Link href={item.href}>{item.label}</Link>
              </Button>
            ))}
            <DropdownMenu>
              <DropdownMenuTrigger className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-base font-medium text-foreground ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground min-h-[44px] px-4 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                Profile <ChevronDown className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 border-2 border-border">
                <DropdownMenuItem className="font-medium text-base text-foreground min-h-11 cursor-pointer focus:bg-muted focus:text-accent focus-visible:ring-2 focus-visible:ring-ring">
                  Archived Goals
                </DropdownMenuItem>
                <DropdownMenuItem className="font-medium text-base text-foreground min-h-11 cursor-pointer focus:bg-muted focus:text-accent focus-visible:ring-2 focus-visible:ring-ring">
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="font-medium text-base text-foreground min-h-11 cursor-pointer focus:bg-muted focus:text-accent focus-visible:ring-2 focus-visible:ring-ring">
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Mobile / Tablet: burger menu */}
          <div className="md:hidden">
            <Drawer>
              <DrawerTrigger asChild>
                <Button variant="ghost" className="p-2">
                  <Menu className="h-6 w-6" />
                </Button>
              </DrawerTrigger>
              <DrawerContent>
                <DrawerHeader className="flex items-center justify-between">
                  <DrawerTitle>Menu</DrawerTitle>
                  <DrawerClose asChild>
                    <Button variant="ghost" className="p-2" aria-label="Close menu">
                      <X className="h-6 w-6" />
                    </Button>
                  </DrawerClose>
                </DrawerHeader>
                <div className="flex flex-col gap-2 p-4">
                  {navItems.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`text-lg font-medium py-3 px-2 rounded hover:bg-muted ${pathname === item.href ? 'text-accent' : 'text-foreground'}`}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              </DrawerContent>
            </Drawer>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Header;
