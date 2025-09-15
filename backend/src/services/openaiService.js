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
                        content: "You are an expert project management analyst. Generate executive reports in the exact format provided, using the project data to create risk assessments, asks, and impact statements. Format the output to be ready for pasting into Slack."
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

        return `Generate an executive project health report in the exact format below. Use the project data provided to create realistic risk assessments, actionable asks, and business impact statements.

REQUIRED FORMAT (copy exactly, replace content):
Project Health
:large_green_circle: [Project Name] ($[ARR]K ARR, closes [date])
risk: [Specific risk based on project health, notes, and status]
ask: [Specific actionable request with owner names from the data]
impact: [Business impact if risk materializes or ask is fulfilled]

[Repeat for each project with appropriate emoji based on health: :large_green_circle: for green, :large_yellow_circle: for yellow, :warning: for red]

:warning: Cross-cutting Risks
[Any systemic risks that affect multiple projects]

:fast_forward: Capacity / Resourcing
FDE utilization at ${utilizationRate}${tierBreakdown}

PROJECT DATA:
${projectsText}

CAPACITY DATA:
Team Utilization: ${utilizationRate}${tierBreakdown}

REPORT PERIOD: ${reportPeriod ? `${reportPeriod.start_date} to ${reportPeriod.end_date}` : 'Current week'}

Generate the report now, ensuring each project has a realistic risk, ask, and impact based on its health status and latest notes. Use the capacity data from the specified report period.`;
    }
}

module.exports = new OpenAIService();