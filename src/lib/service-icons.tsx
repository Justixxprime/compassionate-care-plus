import {
  Stethoscope,
  Activity,
  HandHeart,
  MessageCircle,
  HeartHandshake,
  HandHelping,
  type LucideIcon,
} from "lucide-react";

/*
  Kept separate from services-data.ts on purpose - that file is plain
  data (title, summary, care steps), and mixing presentational icon
  components into it would make it harder to eventually swap for content
  from a real database. This is the only place a service slug maps to a
  visual icon.
*/
export const serviceIcons: Record<string, LucideIcon> = {
  "skilled-nursing": Stethoscope,
  "physical-therapy": Activity,
  "occupational-therapy": HandHeart,
  "speech-therapy": MessageCircle,
  "medical-social-services": HeartHandshake,
  "home-health-aide": HandHelping,
};
