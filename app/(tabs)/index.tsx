import Marketplace from "./shop";

/**
 * Today is now the marketplace home. The former social-video feed is no longer
 * mounted here; the marketplace owns the entire first-tab experience.
 */
export default function Today({ onOpenTools, drawerOpen, onListingOpenChange, onScrollDirectionChange }: { onOpenTools?: () => void; drawerOpen?: boolean; onListingOpenChange?: (open: boolean) => void; onScrollDirectionChange?: (hidden: boolean) => void }) {
  return <Marketplace todayHome onOpenTools={onOpenTools} drawerOpen={drawerOpen} onListingOpenChange={onListingOpenChange} onScrollDirectionChange={onScrollDirectionChange} />;
}
