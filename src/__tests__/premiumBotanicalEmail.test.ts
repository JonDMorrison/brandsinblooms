import {describe,it,expect} from "vitest";
import {
  bloomEmailEscape,bloomEmailIcon,bloomEmailFact,bloomEmailCard,
  renderBloomSystemEmail,
} from "../lib/email/premiumBotanical";

describe("premium botanical system email",()=>{
  it("renders Outlook/Gmail-safe markup and first-party decorative icons",()=>{
    const html=renderBloomSystemEmail({
      eyebrow:"TRIAL UPDATE",title:"Welcome to BloomSuite",preheader:"Your account is ready",
      bodyHtml:"<p>Your trial is active.</p>",icon:"leaf",
      action:{label:"Review setup",url:"https://bloomsuite.app/settings"},
    });
    expect(html).toContain('role="presentation"');
    expect(html).toContain("premium-icons/leaf.png");
    expect(html).toContain('alt=""');
    expect(html).toContain("Your trial is active.");
    expect(html).toContain("https://bloomsuite.app/settings");
    expect(html).toContain("mso-hide:all");
    expect(html).not.toContain("<svg");
    expect(html).not.toContain("fonts.googleapis");
  });
  it("does not put executable values from names, facts, or subjects into markup",()=>{
    const html=renderBloomSystemEmail({
      eyebrow:'<img src=x onerror=alert(1)>',
      title:"Name <script>alert(1)</script>",
      brandName:"<iframe>bad</iframe>",bodyHtml:"<p>Safe author-controlled message</p>",
      action:{url:"javascript:alert(1)",label:"Go"},
    });
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<iframe>");
    expect(html).not.toContain('href="javascript:');
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&lt;iframe&gt;");
    expect(bloomEmailEscape('Hello "world"')).toBe("Hello &quot;world&quot;");
    const row=bloomEmailFact("A<script>","B <img>","water");
    expect(row).toContain("&lt;script&gt;");
    expect(row).toContain("&lt;img&gt;");
    expect(row).not.toContain("<script>");
  });
  it("uses tasteful labels and separate facts without inventing values",()=>{
    const html=bloomEmailCard("Garden care",[
      {icon:"sun",label:"Light",value:"Morning sun"},
      {icon:"water",label:"Water",value:"Even moisture"},
      {icon:"soil",label:"Soil",value:"Well drained"},
    ]);
    expect(html).toContain("premium-icons/sun.png");
    expect(html).toContain("premium-icons/water.png");
    expect(html).toContain("premium-icons/soil.png");
    expect(html).toContain("Morning sun");
    expect(html).toContain("Even moisture");
    expect(html).toContain("Well drained");
    expect(bloomEmailCard("Empty",[])).toBe("");
  });
  it("preserves brand name and support copy when images are blocked",()=>{
    const html=renderBloomSystemEmail({
      brandName:"Baltimore Valley Garden Centre",
      eyebrow:"SUPPORT",title:"Your onboarding is ready",
      icon:"mail",bodyHtml:"<p>Ask the team for help.</p>",
      footer:"You can reply to this message.",
    });
    expect(html).toContain("Baltimore Valley Garden Centre");
    expect(html).toContain("You can reply to this message.");
    expect(html).toContain("Ask the team for help.");
    expect(html).toContain("#1B3049");
  });
  it("allows only HTTPS action links and prevents credential URL leaks",()=>{
    for(const url of ["/settings","javascript:alert(1)","http://example.com","https://user:password@example.com/"]){
      const html=renderBloomSystemEmail({eyebrow:"TEST",title:"Link",bodyHtml:"",action:{label:"Click",url}});
      expect(html).not.toContain('href="');
    }
  });
});
