import yargs from 'https://deno.land/x/yargs/deno.ts'
import { Eta } from "https://deno.land/x/eta@v3.1.0/src/index.ts";
import chalkin from "https://deno.land/x/chalkin/mod.ts";
import moment from 'npm:moment'

type Arguments = ReturnType<typeof yargs>

type ParsedArgs = {
    template: string
    note: string
    date: string
} & Record<string, string>

async function getTemplate(template: string) {
    const cmd = new Deno.Command("nb", {
        args: [
            'show',
            '--no-color',
            '--print',
            template
        ]
    })

    const result = await cmd.output()

    return result
}

function renderTemplate(template: string, vars: Record<string, unknown>) {
    const eta = new Eta({
        useWith: true
    })

    return eta.renderString(template, vars)
}

async function createNote(filename: string, content: string) {
    const cmd = new Deno.Command("nb", {
        args: [
            'add',
            '--filename',
            filename,
            '--content',
            content
        ]
    })

    const result = await cmd.output()

    return result
}

const desc =
`Creates a note from another note as a template.

The template note can include variables that will be replaced with the values specified as flags/options:

E.g. --var val

Additionally, moment() is available as a function to format dates within your template:

E.g. <%= moment().format('YYYY-MM-DD') %>

Templates are powered using ${chalkin.italic('eta')}. See https://eta.js.org/ for more information.
`

yargs(Deno.args)
    .wrap(Deno.consoleSize().columns)
    .command(
        '$0 <template> <note>',
        desc,
        (yargs: Arguments) => {
            yargs.positional('template', {
                describe: '[<notebook>:][<folder-path>/][<id> | <filename> | <title>]',
                type: 'string',
            })
            yargs.positional('note', {
                describe: '[<notebook>:][<folder-path>/]<filename>',
                type: 'string',
            })
            yargs.option('date', {
                describe: 'Date variable. Default is today.',
                type: 'string',
                default: moment()
            })
            yargs.option('title', {
                describe: 'Title variable. If present, the template name will be replaced with this value.',
                type: 'string',
                optional: true
            })
            yargs.option('removeTitle', {
                describe: 'Remove the title from the template.',
                type: 'boolean',
                default: true
            })
            yargs.option('dry-run', {
                describe: 'Print the rendered template without creating a new note.',
                type: 'boolean',
                default: false
            })
        },
        async (argv: ParsedArgs) => {
            // Get template
            const template = await getTemplate(argv.template)

            // No template? Exit with error
            if (template.code !== 0) {
                console.error(template.stderr)
                Deno.exit(1)
            }

            // Render template
            let rendered = renderTemplate(new TextDecoder().decode(template.stdout), {
                ...argv,
                moment
            })

            // If a title was provided, replace the first heading
            if (argv.title) {
                rendered = rendered.replace(/^\#.*$/m, `# ${argv.title}`)
            }
            else if (argv.removeTitle) {
                rendered = rendered.replace(/^\#.*$/m, '')
            }

            // Print if dry-run
            if (argv['dry-run']) {
                Deno.stdout.write(new TextEncoder().encode(rendered))
                Deno.exit(0)
            }

            // Create note
            const note = await createNote(argv.note, rendered)

            // No note? Exit with error
            if (note.code !== 0) {
                console.error(note.stderr)
                Deno.exit(1)
            }

            console.log("Note created.")
        }
    )
    .parse()