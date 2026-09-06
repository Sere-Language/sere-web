import Navbar from "./Navbar";
import NavbarButton from "./NavbarButton";
export default function SiteNavbar() {
  return (
    <Navbar>
      <NavbarButton href="/install">Install</NavbarButton>
      <NavbarButton href="/docs">Docs</NavbarButton>
      <NavbarButton href="/libraries">Libraries</NavbarButton>
      <NavbarButton href="/issues">Issues</NavbarButton>
      <NavbarButton href="/community">Community</NavbarButton>
      <NavbarButton href="/contribution">Contribution</NavbarButton>
    </Navbar>
  );
}
