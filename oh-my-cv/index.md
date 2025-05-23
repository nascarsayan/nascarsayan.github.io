---
name: Sayan Naskar
header:
  - text: <span class="iconify" data-icon="tabler:phone"></span> (+91) 97354-40134
  - text: <span class="iconify" data-icon="tabler:mail"></span> nascarsayan@gmail.com
    link: mailto:nascarsayan@gmail.com
  - text: <span class="iconify" data-icon="tabler:brand-github"></span> nascarsayan
    link: https://github.com/nascarsayan
  - text: <span class="iconify" data-icon="tabler:brand-linkedin"></span> nascarsayan
    link: https://www.linkedin.com/in/nascarsayan/
---

## Education

**IIT Kharagpur**
  ~ 2015-2020

Dual Degree (B.Tech + M.Tech), Computer Science and Engineering

---

## Skills and Expertise

<section class="skills">

**Platform:**
<span class="iconify" data-icon="carbon:logo-kubernetes"></span> Kubernetes
<span class="iconify" data-icon="ion:logo-docker"></span> Docker
<span class="iconify" data-icon="tabler:brand-azure"></span> Azure
<span class="iconify" data-icon="fa6-brands:aws"></span> AWS
<span class="iconify" data-icon="fa6-brands:digital-ocean"></span> DigitalOcean
<span class="iconify" data-icon="cib:oracle"></span> Oracle Cloud
<span class="iconify" data-icon="fa6-brands:cloudflare"></span> Cloudflare

**Programming Languages:**
<span class="iconify" data-icon="devicon-plain:go"></span> Go
<span class="iconify" data-icon="teenyicons:python-outline"></span> Python
<span class="iconify" data-icon="devicon:bash"></span> Bash
<span class="iconify" data-icon="tabler:brand-powershell"></span> PowerShell
<span class="iconify" data-icon="file-icons:kusto-alt"></span> Kusto
<span class="iconify" data-icon="devicon-plain:csharp"></span> C#
<span class="iconify" data-icon="ri:java-fill"></span> Java
<span class="iconify" data-icon="cib:cplusplus"></span> C++

**Frameworks & Libraries:**
<span class="iconify" data-icon="simple-icons:react"></span> React.js
<span class="iconify" data-icon="mingcute:vue-line"></span> Vue.js
<span class="iconify" data-icon="simple-icons:pocketbase"></span> PocketBase
<span class="iconify" data-icon="devicon-plain:playwright"></span> Playwright
<span class="iconify" data-icon="simple-icons:graphql"></span> GraphQL
<span class="iconify" data-icon="akar-icons:node-fill"></span> Node.js
<span class="iconify" data-icon="mdi:dot-net"></span> .NET

**Tools:**
<span class="iconify" data-icon="simple-icons:helm"></span> Helm
<span class="iconify" data-icon="mdi:terraform"></span> Terraform
<span class="iconify" data-icon="simple-icons:prometheus"></span> Prometheus
<span class="iconify" data-icon="devicon-plain:grafana"></span> Grafana
<span class="iconify" data-icon="devicon-plain:duckdb"></span> DuckDB
<span class="iconify" data-icon="simple-icons:caddy"></span> Caddy | NGINX
<span class="iconify" data-icon="emojione-monotone:squid"></span> Squid
<span class="iconify" data-icon="teenyicons:mongodb-outline"></span> MongoDB

</section>

---

## Experience

<strong><span class="iconify" data-icon="mdi:microsoft"></span> Microsoft | Software Engineer II</strong>
  ~ Hyderabad | 07/2020 - Present

### Kubernetes Operator for [Azure Arc][1] on VMWare and SCVMM
- Led core development of the **Kubernetes operator** for Azure Hybrid Cloud on [VMware][2]/[SCVMM][3], driving it from inception to **GA launch in Nov 2023**.
- Reduced **SCVMM inventory sync time from 36m to 9m (4x speed-up)**, also **reduced memory usage by 30%**.
- Reduced the **guest agent installation failure rate by 50%** by adding SSH and PowerShell fallback channels.
- Reduced **network traffic by 10x with faster serialization** by generating PowerShell scripts from Go to filter data at the edge.

### Customer Onboarding and Support
- Oversaw onboarding of 30+ AVS and VMware customers (**with >2000 VMs**) to Azure Arc. Improved **onboarding success from 65% to 92%** by incorporating the learnings.
- **Resolved a critical onboarding blocker for a $105K-revenue customer** caused by vCenter IP conflict with the Kubernetes Pod CIDR. Worked with a Cloud Solution Architect to [create an L7 Proxy workaround][4].
- Created the onboarding, batch-install, deboarding [scripts][5].  Built internal codegen tools and Azure CLI extension for [connectedvmware][6]/[scvmm][7].
- Created a process for simulating customer setups (using NSX, iptables, [squid proxy][8], AD) to test and fix issues.

### [ArcAppliance][9] (Microsoft-managed Kubernetes cluster for Azure Arc)
- Found and fixed **two major platform regressions**: inode exhaustion and vCenter session leak ([reported][10] and [fixed upstream][11]).
- Designed **the KMS plugin for the encryption of secrets at rest in etcd** in VMWare appliance.

### Azure Migrate
- Working on **software categorization and end-of-life (EOL) detection** to address vital use-cases for potential Azure migrate customers.

### Mentorship
- Mentored two interns (Summer 2023, Summer 2024).

[1]: https://azure.microsoft.com/en-us/products/azure-arc
[2]: https://learn.microsoft.com/en-us/azure/azure-arc/vmware-vsphere/overview
[3]: https://learn.microsoft.com/en-us/azure/azure-arc/system-center-virtual-machine-manager/overview
[4]: https://github.com/Azure/arcvmware-util/blob/master/drafts/Virtual-IP-for-vCenter.md
[5]: https://github.com/Azure/azure-arc-for-vmware-scripts
[6]: https://github.com/Azure/azure-cli-extensions/tree/main/src/connectedvmware
[7]: https://github.com/Azure/azure-cli-extensions/tree/main/src/scvmm
[8]: https://github.com/Azure/arcvmware-util/tree/master/squid-proxy-setup
[9]: https://learn.microsoft.com/en-us/azure/azure-arc/resource-bridge/overview
[10]: https://github.com/kubernetes-sigs/cluster-api-provider-vsphere/issues/2066
[11]: https://github.com/kubernetes-sigs/cluster-api-provider-vsphere/pull/2235

<strong><span class="iconify" data-icon="simple-icons:samsung"></span> Samsung R&D Institute | Software Developer Intern</strong>
  ~ Bengaluru | 05/2019 - 07/2019

- Built a CLI tool and an web app and for **visualizing bounding-box annotations of image datasets**, and **version control the annotation data** using git.

<strong><span class="iconify" data-icon="icon-park-outline:sapling"></span> Dhanotree | Founding Engineer</strong>
  ~ Kolkata | 12/2016 - 12/2019

- Built and launched **HindPOS Ausadhi POS app** for pharmacy retailers; sold to **20+ customers**.
- Set up **IT Infrastructure** on DigitalOcean, comprising Let's Encrypt, nginx, internal git, chat, and mail servers.

---

## Certifications

**Cisco Certified Entry Networking Technician (CCENT)**
  ~ [View Credential](https://www.credly.com/badges/4fa63ab8-61c4-4524-bac5-cc7e72a5f3b3/public_url)

**Cisco Certified Network Associate Routing and Switching (CCNA)**
  ~ [View Credential](https://www.credly.com/badges/a3c6fc57-6f7b-4179-b546-fed8465ec123/public_url)


<!-- **Programming Languages:** <span class="iconify" data-icon="vscode-icons:file-type-python"></span> Python, <span class="iconify" data-icon="vscode-icons:file-type-js-official"></span> JavaScript / <span class="iconify" data-icon="vscode-icons:file-type-typescript-official"></span> TypeScript, <span class="iconify" data-icon="vscode-icons:file-type-cpp2"></span> C++, <span class="iconify" data-icon="logos:java" data-inline="false"></span> Java

**Tools and Frameworks:** MongoDB, Express, GraphQL, React.js, Vue.js, Node.js, Gitlab CE, Digital Ocean, Nginx, AWS, Serverless, Docker, Kubernetes, Helm, Azure, Prometheus, Grafana, PowerShell, Python, DotNet Core -->