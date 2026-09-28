// Website editor, Journal, Gallery, Events, Media library. (Built next.)
import { Empty } from '../../components/ui';
const Soon = ({ what }: { what: string }) => <Empty>{what} editor is being set up.</Empty>;
export const WebsiteEditor = () => <Soon what="Website" />;
export const JournalEditor = () => <Soon what="Journal" />;
export const GalleryEditor = () => <Soon what="Gallery" />;
export const EventsEditor = () => <Soon what="Events" />;
export const MediaLibrary = () => <Soon what="Media" />;
