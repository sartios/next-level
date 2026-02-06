import { Separator } from '@/components/ui/separator';

const footerLinks = {
  product: [
    { name: 'How It Works', href: '#how-it-works' },
    { name: 'FAQ', href: '#faq' }
  ],
  team: [
    { name: 'About', href: '#about' },
    { name: 'Contact', href: '#contact' }
  ]
};

export default function Footer() {
  return (
    <footer className="bg-background max-w-6xl mx-auto mt-10 md:mt-20 xl:mt-28">
      <div className="container mx-auto py-12 px-4 xl:px-0 border-t-2 border-muted">
        <div className="flex flex-col lg:flex-row justify-between mb-4">
          <h3 className="text-2xl font-extrabold text-foreground mb-4">
            Next<span className="text-accent">Level</span>
          </h3>
          <p className="text-base text-muted-foreground">
            AI-powered learning journeys that adapt to you. Turn career aspirations into achievements.
          </p>
        </div>

        <Separator className="mb-4 bg-muted" />

        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} NextLevel. All rights reserved.</p>
          <div className="flex gap-6">
            <a
              href="#github"
              className="text-sm text-muted-foreground hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-colors"
              aria-label="GitHub"
            >
              GitHub
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
