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
    <footer className="bg-background border-t border-border">
      <div className="container mx-auto px-4 py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          <div className="md:col-span-1">
            <h3 className="text-2xl font-extrabold text-foreground mb-4">NextLevel</h3>
            <p className="text-base text-muted-foreground">
              AI-powered learning journeys that adapt to you. Turn career aspirations into achievements.
            </p>
          </div>

          <div>
            <h4 className="text-lg font-bold text-foreground mb-4">Product</h4>
            <ul className="space-y-3" role="list">
              {footerLinks.product.map((link) => (
                <li key={link.name}>
                  <a
                    href={link.href}
                    className="text-base text-muted-foreground hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-colors"
                  >
                    {link.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-lg font-bold text-foreground mb-4">Team</h4>
            <ul className="space-y-3" role="list">
              {footerLinks.team.map((link) => (
                <li key={link.name}>
                  <a
                    href={link.href}
                    className="text-base text-muted-foreground hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-colors"
                  >
                    {link.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <Separator className="mb-8 bg-border" />

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
