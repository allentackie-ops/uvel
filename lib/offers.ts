import { httpsCallable } from "firebase/functions";
import { doc, onSnapshot } from "firebase/firestore";
import { firebaseAuth, firebaseDb, firebaseFunctions, firebaseReady } from "./firebase";
import { suggestedOfferCents } from "./offerMath";

export { suggestedOfferCents };

export type ListingOfferStatus = "pending" | "accepted" | "declined" | "expired" | "purchased";
export type ListingOffer = {
  id: string;
  listingId: string;
  threadId: string;
  buyerId: string;
  buyerName: string;
  buyerUsername?: string;
  buyerPhoto?: string;
  sellerId: string;
  sellerName: string;
  listingName: string;
  listingPhoto: string;
  currency: string;
  offerCents: number;
  agreedPriceCents?: number | null;
  status: ListingOfferStatus;
  createdAt?: unknown;
  expiresAt?: unknown;
  checkoutExpiresAt?: unknown;
  responseMessage?: string;
};

export async function createListingOffer(listingId: string, offerCents: number) {
  if (!firebaseReady() || !firebaseAuth().currentUser) throw new Error("Sign in before making an offer.");
  const call = httpsCallable<{ listingId: string; offerCents: number }, { offerId: string; threadId: string; status: "pending"; offerCents: number; currency: string; expiresAt: number }>(firebaseFunctions(), "createListingOffer");
  const result = await call({ listingId, offerCents });
  return result.data;
}

export async function respondToListingOffer(offerId: string, decision: "accepted" | "declined", message = "") {
  if (!firebaseReady() || !firebaseAuth().currentUser) throw new Error("Sign in to respond to this offer.");
  const call = httpsCallable<{ offerId: string; decision: "accepted" | "declined"; message?: string }, { offerId: string; status: ListingOfferStatus; responseMessage: string; checkoutExpiresAt: number | null }>(firebaseFunctions(), "respondToListingOffer");
  const result = await call({ offerId, decision, ...(message.trim() ? { message: message.trim().slice(0, 500) } : {}) });
  return result.data;
}

export function watchListingOffer(offerId: string, onOffer: (offer: ListingOffer | null) => void) {
  if (!firebaseReady() || !firebaseAuth().currentUser || !offerId) {
    onOffer(null);
    return () => undefined;
  }
  return onSnapshot(doc(firebaseDb(), "listingOffers", offerId), (snapshot) => {
    onOffer(snapshot.exists() ? ({ id: snapshot.id, ...(snapshot.data() as Omit<ListingOffer, "id">) }) : null);
  }, () => onOffer(null));
}
