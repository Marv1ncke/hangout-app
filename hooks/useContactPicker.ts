import { useState, useEffect } from "react";

interface SelectedContact {
  name: string;
  tel?: string;
}

export function useContactPicker() {
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    // Check of de browser in 2026 de native Contact Picker ondersteunt
    if (typeof window !== "undefined" && "contacts" in navigator && "ContactsManager" in window) {
      setIsSupported(true);
    }
  }, []);

  const pickContact = async (): Promise<SelectedContact | null> => {
    if (!isSupported) return null;

    try {
      // We vragen alleen om de naam en eventueel het telefoonnummer
      const props = ["name", "tel"];
      const options = { multiple: false }; // Één contact tegelijk selecteren
      
      const contacts = await (navigator as any).contacts.select(props, options);
      
      if (contacts && contacts.length > 0) {
        const contact = contacts[0];
        return {
          name: contact.name?.[0] || "Onbekende vriend",
          tel: contact.tel?.[0] || ""
        };
      }
    } catch (err) {
      console.log("Contact selectie geannuleerd of mislukt:", err);
    }
    return null;
  };

  return { isSupported, pickContact };
}