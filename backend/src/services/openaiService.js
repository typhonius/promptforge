const OpenAI = require('openai');

class OpenAIService {
    constructor() {
        this.client = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });
    }

    async generateAIReport(projectData) {
        try {
            const prompt = this.buildReportPrompt(projectData);
            
            const completion = await this.client.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    {
                        role: "system",
                        content: "You are an executive project analyst generating C-level status reports. Write from the perspective of a Director reporting to senior executives (COO, VP Sales, VP GTM). Prioritize business impact, revenue risk, resource bottlenecks, and actionable decisions. Use data-driven insights with specific financial figures. Identify critical blockers requiring executive intervention and propose concrete solutions with clear ownership."
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                temperature: 0.7,
                max_tokens: 2000
            });

            return completion.choices[0].message.content;
        } catch (error) {
            console.error('OpenAI API Error:', error);
            throw new Error('Failed to generate AI report');
        }
    }

    buildReportPrompt(projectData) {
        const { projects, capacityData, reportPeriod } = projectData;
        
        let projectsText = '';
        if (projects && projects.length > 0) {
            projectsText = projects.map(project => {
                return `Project: ${project.project_name}
ARR: $${project.arr_value ? (project.arr_value / 1000).toFixed(1) : '0.0'}K
Health: ${project.health}
Close Date: ${project.close_date || 'TBD'}
Status: ${project.status}
Latest Note: ${project.latest_note || 'No recent notes'}
Owners: ${[project.tier_1_name, project.tier_2_name].filter(name => name).join(', ') || 'Unassigned'}`;
            }).join('\n\n');
        }

        const utilizationRate = capacityData ? `${capacityData.utilization_percentage}%` : 'N/A';
        
        // Format tier breakdown for capacity section
        let tierBreakdown = '';
        if (capacityData && capacityData.tier_breakdown) {
            const tierInfo = [];
            ['tier1', 'tier2', 'tier3'].forEach(tierKey => {
                const tier = capacityData.tier_breakdown[tierKey];
                if (tier && tier.total_users > 0) {
                    const tierNum = tierKey.replace('tier', '');
                    tierInfo.push(`Tier ${tierNum}: ${tier.utilization_percentage}% (${tier.active_users}+${tier.total_users - tier.active_users} FDEs)`);
                }
            });
            tierBreakdown = tierInfo.length > 0 ? '\n' + tierInfo.join('\n') : '';
        }

        return `Create an executive status report for VP/COO audience. Analyze project data to identify risks, specific asks, and business impacts.

CRITICAL REQUIREMENTS:
For each project, provide exactly three elements:
- RISK: Specific threat to delivery, revenue, or operations based on health status and notes
- ASK: Concrete action item with named executive owner (COO for resources/infrastructure, VP Sales for adoption/customer issues)
- IMPACT: Quantified business consequence (ARR at risk, timeline delays, operational costs)

REPORT STRUCTURE:
1. **Project Health Dashboard**
   - Use 🟢🟡🔴 based on health status
   - Each project must have: Risk + Ask + Impact

2. **Cross-Cutting Risks**
   - Identify systemic issues affecting multiple projects
   - Focus on: engineering bottlenecks, resource constraints, process gaps, technology dependencies

3. **Capacity & Resource Analysis**
   - Current utilization: ${utilizationRate}${tierBreakdown}
   - Engineering dependencies blocking progress
   - Resource gaps requiring executive action

4. **Executive Actions Required**
   - Immediate decisions needed from COO and VP Sales
   - 30-day milestones with success metrics

ANALYSIS GUIDELINES:
- Red projects = high revenue risk, immediate executive intervention needed
- Yellow projects = delivery risk, resource/process asks required
- Green projects = on track, but identify optimization opportunities
- Cross-cutting risks = patterns affecting multiple projects (shared dependencies, resource conflicts, process breakdowns)

PROJECT DATA:
${projectsText}

CAPACITY DATA:
Team utilization: ${utilizationRate}${tierBreakdown}
Report period: ${reportPeriod ? `${reportPeriod.start_date} to ${reportPeriod.end_date}` : 'Current week'}

Generate a strategic report with specific risks, actionable asks, and quantified impacts for each project, plus cross-cutting risks affecting multiple initiatives.`;
    }
}

module.exports = new OpenAIService();