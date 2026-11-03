<script setup lang="ts">
import { Paperclip } from '@lucide/vue'
import { useQueryClient } from '@tanstack/vue-query'
import { Extension, type Editor, type JSONContent, type Range } from '@tiptap/core'
import { Placeholder } from '@tiptap/extensions'
import { PluginKey } from '@tiptap/pm/state'
import Suggestion from '@tiptap/suggestion'
import { EditorContent, useEditor } from '@tiptap/vue-3'
import { computed, onBeforeUnmount, reactive, ref, useTemplateRef, watch } from 'vue'
import { toast } from 'vue-sonner'
import { useUpload } from '@/features/uploads/useUpload'
import { errorMessage } from '@/lib/errors'
import { orpc } from '@/lib/orpc'
import { cn } from '@/lib/utils'
import AttachmentImageView from './AttachmentImageView.vue'
import {
  ATTACHMENT_TYPES,
  attachmentError,
  attachmentHref,
  isImageType,
  parseAttachmentId,
} from './attachments'
import CodeBlockView from './CodeBlockView.vue'
import EditorBubbleMenu from './EditorBubbleMenu.vue'
import { markdownExtensions } from './extensions'
import IssueMentionView from './IssueMentionView.vue'
import MathBlockView from './MathBlockView.vue'
import MentionMenu from './MentionMenu.vue'
import { useMentionSuggestions } from './mention-suggestions'
import { filterSlashCommands, type SlashCommand, type SlashContext } from './slash-commands'
import SlashMenu from './SlashMenu.vue'
import UserMentionView from './UserMentionView.vue'

// Rich text that reads and writes markdown, like Linear's editor: markdown
// shortcuts as you type, a `/` block menu (headings, lists, media and files,
// code, diagrams, math, collapsible sections, quotes), a formatting toolbar on
// selection, and file uploads by paperclip, paste or drop. The stored value is
// always markdown; uploads are referenced as `attachment:<uploadId>`.
const props = withDefaults(
  defineProps<{
    placeholder?: string
    label: string
    class?: string
    /** Enables @mentions and attachments (stored in this workspace). */
    workspaceSlug?: string
    /** Attachments need somewhere to be tracked (descriptions); comments turn them off. */
    attachments?: boolean
    /** Renders the markdown without editing (comment bodies). */
    readonly?: boolean
  }>(),
  {
    placeholder: undefined,
    class: undefined,
    workspaceSlug: undefined,
    attachments: true,
    readonly: false,
  },
)
const model = defineModel<string>({ default: '' })

const root = useTemplateRef<HTMLElement>('root')
const fileInput = useTemplateRef<HTMLInputElement>('fileInput')
const queryClient = useQueryClient()
const { upload } = useUpload()

// ---------------------------------------------------------------- uploads

// Where attachments are stored; unset turns attachments off.
const attachmentSlug = computed(() => (props.attachments ? props.workspaceSlug : undefined))

const pendingUploads = ref(0)
const fileAccept = ref(ATTACHMENT_TYPES.join(','))
let nextPlaceholder = 0

function pickFiles(kind: 'media' | 'files' = 'files') {
  if (!attachmentSlug.value) return
  fileAccept.value =
    kind === 'media' ? ATTACHMENT_TYPES.filter(isImageType).join(',') : ATTACHMENT_TYPES.join(',')
  // Wait a tick so the input picks up the new `accept`.
  queueMicrotask(() => fileInput.value?.click())
}

function onFilesPicked(event: Event) {
  const input = event.target as HTMLInputElement
  void attachFiles([...(input.files ?? [])])
  input.value = ''
}

// Found fresh each time: the document may have changed while the file uploaded.
function findImage(e: Editor, src: string): number | null {
  const found: number[] = []
  e.state.doc.descendants((node, pos) => {
    if (node.type.name === 'image' && node.attrs.src === src) found.push(pos)
  })
  return found[0] ?? null
}
function findLinkRange(e: Editor, href: string): { from: number; to: number } | null {
  const found: { from: number; to: number }[] = []
  e.state.doc.descendants((node, pos) => {
    if (node.isText && node.marks.some((m) => m.type.name === 'link' && m.attrs.href === href)) {
      found.push({ from: pos, to: pos + node.nodeSize })
    }
  })
  return found[0] ?? null
}

/**
 * Inserts a placeholder right away (a local preview for images, an "Uploading…" link
 * for files), uploads, then swaps in the `attachment:` reference — or removes the
 * placeholder and explains why if the upload fails.
 */
async function attachFiles(files: File[], at?: number) {
  const e = editor.value
  const workspaceSlug = attachmentSlug.value
  if (!e || !workspaceSlug || files.length === 0) return
  let pos = at ?? e.state.selection.to

  for (const file of files) {
    const problem = attachmentError(file)
    if (problem) {
      toast.error(`Can't attach ${file.name}`, { description: problem })
      continue
    }
    const image = isImageType(file.type)
    const placeholder = image
      ? URL.createObjectURL(file)
      : `attachment:pending-${++nextPlaceholder}`
    const content: JSONContent[] = image
      ? [{ type: 'image', attrs: { src: placeholder, alt: file.name, uploading: true } }]
      : [
          {
            type: 'text',
            text: `Uploading ${file.name}…`,
            marks: [{ type: 'link', attrs: { href: placeholder } }],
          },
          { type: 'text', text: ' ' },
        ]
    e.chain().focus().insertContentAt(pos, content).run()
    pos = e.state.selection.to

    pendingUploads.value++
    void upload(file, { kind: 'attachment', workspaceSlug })
      .then((uploadId) => {
        const href = attachmentHref(uploadId)
        if (image) {
          const at = findImage(e, placeholder)
          if (at === null) return
          const node = e.state.doc.nodeAt(at)
          e.view.dispatch(
            e.state.tr.setNodeMarkup(at, undefined, {
              ...node?.attrs,
              src: href,
              uploading: false,
            }),
          )
        } else {
          const range = findLinkRange(e, placeholder)
          if (!range) return
          const link = e.schema.marks.link!.create({ href })
          e.view.dispatch(
            e.state.tr.replaceWith(range.from, range.to, e.schema.text(file.name, [link])),
          )
        }
      })
      .catch((error: unknown) => {
        if (image) {
          const at = findImage(e, placeholder)
          const node = at === null ? null : e.state.doc.nodeAt(at)
          if (at !== null && node) e.view.dispatch(e.state.tr.delete(at, at + node.nodeSize))
        } else {
          const range = findLinkRange(e, placeholder)
          if (range) e.view.dispatch(e.state.tr.delete(range.from, range.to))
        }
        toast.error(`Couldn't upload ${file.name}`, {
          description:
            error instanceof Error && !('code' in error) ? error.message : errorMessage(error),
        })
      })
      .finally(() => {
        pendingUploads.value--
        // The image now loads from the attachment URL; the preview can go.
        if (image) setTimeout(() => URL.revokeObjectURL(placeholder), 30_000)
      })
  }
}

/** Opens an attachment link in a new tab via a fresh presigned URL. */
async function openAttachment(uploadId: string) {
  // Open synchronously (inside the click) so the popup isn't blocked, then navigate.
  const tab = window.open('', '_blank')
  try {
    const { url } = await queryClient.fetchQuery({
      ...orpc.uploads.getUrl.queryOptions({ input: { uploadId } }),
      staleTime: 10 * 60_000,
    })
    if (tab) {
      tab.opener = null
      tab.location.href = url
    }
  } catch (error) {
    tab?.close()
    toast.error("Couldn't open the attachment", { description: errorMessage(error) })
  }
}

// Drag-over highlight; a counter because dragenter/leave fire for every child.
const dragDepth = ref(0)
const hasFiles = (event: DragEvent) => event.dataTransfer?.types.includes('Files') ?? false
function onDragEnter(event: DragEvent) {
  if (attachmentSlug.value && hasFiles(event)) dragDepth.value++
}
function onDragLeave(event: DragEvent) {
  if (hasFiles(event)) dragDepth.value = Math.max(0, dragDepth.value - 1)
}

// ---------------------------------------------------------------- slash menu

const slash = reactive({
  open: false,
  items: [] as SlashCommand[],
  active: 0,
  range: null as Range | null,
  getRect: (() => null) as () => DOMRect | null,
})
const slashContext: SlashContext = { pickFiles }

const availableCommands = (query: string) =>
  filterSlashCommands(query).filter(
    (c) => attachmentSlug.value || (c.id !== 'media' && c.id !== 'files'),
  )

function runSlash(command: SlashCommand | undefined) {
  if (!command || !slash.range || !editor.value) return
  command.run(editor.value, slash.range, slashContext)
  slash.open = false
}

const SlashCommands = Extension.create({
  name: 'slashCommands',
  addProseMirrorPlugins() {
    return [
      Suggestion<SlashCommand>({
        editor: this.editor,
        pluginKey: new PluginKey('slashCommands'),
        char: '/',
        startOfLine: false,
        // Only at the start of a word, so URLs like a/b don't open it.
        allowedPrefixes: [' '],
        items: ({ query }) => availableCommands(query),
        render: () => ({
          onStart: (p) => {
            Object.assign(slash, {
              open: true,
              items: p.items,
              active: 0,
              range: p.range,
              getRect: () => p.clientRect?.() ?? null,
            })
          },
          onUpdate: (p) => {
            Object.assign(slash, {
              items: p.items,
              active: 0,
              range: p.range,
              getRect: () => p.clientRect?.() ?? null,
            })
          },
          onKeyDown: ({ event }) => {
            const count = slash.items.length
            if (event.key === 'ArrowDown' && count) {
              slash.active = (slash.active + 1) % count
              return true
            }
            if (event.key === 'ArrowUp' && count) {
              slash.active = (slash.active - 1 + count) % count
              return true
            }
            if (event.key === 'Enter' || event.key === 'Tab') {
              if (!count) return false
              runSlash(slash.items[slash.active])
              return true
            }
            if (event.key === 'Escape') {
              // Close the menu, not the dialog around the editor.
              event.stopPropagation()
              slash.open = false
              return true
            }
            return false
          },
          onExit: () => {
            slash.open = false
          },
        }),
      }),
    ]
  },
})

const EditorShortcuts = Extension.create({
  name: 'editorShortcuts',
  addKeyboardShortcuts() {
    return {
      // Leave Mod-Enter to the surrounding form (submit) instead of inserting a line break.
      'Mod-Enter': () => true,
      'Mod-Shift-u': () => {
        pickFiles('files')
        return true
      },
    }
  },
})

// ---------------------------------------------------------------- mentions

const mentions = useMentionSuggestions({
  workspaceSlug: () => props.workspaceSlug,
  editor: () => editor.value,
})

// ---------------------------------------------------------------- editor

const editor = useEditor({
  content: model.value,
  editable: !props.readonly,
  contentType: 'markdown',
  extensions: [
    ...markdownExtensions({
      image: AttachmentImageView,
      codeBlock: CodeBlockView,
      math: MathBlockView,
      userMention: UserMentionView,
      issueMention: IssueMentionView,
    }),
    Placeholder.configure({
      placeholder: ({ node }) =>
        node.type.name === 'detailsSummary' ? 'Section title' : (props.placeholder ?? ''),
      includeChildren: true,
    }),
    SlashCommands,
    mentions.extension,
    EditorShortcuts,
  ],
  editorProps: {
    attributes: props.readonly
      ? { class: 'markdown-body outline-hidden', role: 'group', 'aria-label': props.label }
      : {
          class: 'markdown-body outline-hidden',
          role: 'textbox',
          'aria-multiline': 'true',
          'aria-label': props.label,
        },
    handleDrop: (view, event, _slice, moved) => {
      dragDepth.value = 0
      const files = [...(event.dataTransfer?.files ?? [])]
      if (moved || files.length === 0 || !attachmentSlug.value) return false
      event.preventDefault()
      const at = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos
      void attachFiles(files, at)
      return true
    },
    handlePaste: (_view, event) => {
      const files = [...(event.clipboardData?.files ?? [])]
      if (files.length === 0 || !attachmentSlug.value) return false
      void attachFiles(files)
      return true
    },
    handleClick: (_view, _pos, event) => {
      const link = (event.target as HTMLElement | null)?.closest('a')
      const uploadId = parseAttachmentId(link?.getAttribute('href'))
      if (!uploadId) return false
      event.preventDefault()
      void openAttachment(uploadId)
      return true
    },
  },
  onUpdate: ({ editor: e }) => {
    model.value = e.isEmpty ? '' : e.getMarkdown()
  },
})

// Outside changes (a form reset) replace the content; our own updates are skipped.
watch(model, (value) => {
  const e = editor.value
  if (!e) return
  const current = e.isEmpty ? '' : e.getMarkdown()
  if (value !== current)
    e.commands.setContent(value, { contentType: 'markdown', emitUpdate: false })
})

onBeforeUnmount(() => editor.value?.destroy())

const appendTo = () => root.value ?? document.body
const showSlash = computed(() => slash.open && Boolean(editor.value))

defineExpose({
  // `view.focus()` is synchronous (`commands.focus` waits a frame), so keys typed right
  // after moving focus here land in the editor.
  focus: () => editor.value?.view.focus(),
  pickFiles,
  /** Uploads still in flight; their placeholders aren't valid markdown references yet. */
  pendingUploads,
})
</script>

<template>
  <!-- Clicking the empty area below the text (a tall, expanded editor) focuses the end. -->
  <div
    ref="root"
    :class="cn('relative', !readonly && 'cursor-text', props.class)"
    @mousedown.self="!readonly && ($event.preventDefault(), editor?.commands.focus('end'))"
    @dragenter="onDragEnter"
    @dragleave="onDragLeave"
    @drop="dragDepth = 0"
  >
    <EditorContent :editor="editor" />
    <EditorBubbleMenu v-if="editor" :editor="editor" :append-to="appendTo" />
    <MentionMenu
      v-if="mentions.visible.value && editor"
      :kind="mentions.state.kind"
      :items="mentions.items.value"
      :active="mentions.state.active"
      :loading="mentions.loading.value"
      :get-rect="mentions.state.getRect"
      @hover="mentions.state.active = $event"
      @select="mentions.select"
    />
    <SlashMenu
      v-if="showSlash"
      :items="slash.items"
      :active="slash.active"
      :get-rect="slash.getRect"
      @hover="slash.active = $event"
      @select="runSlash"
    />
    <div
      v-if="dragDepth > 0"
      class="pointer-events-none absolute inset-0 flex items-center justify-center rounded-md border border-dashed border-primary bg-floating/85 text-[13px] text-ink-muted"
      aria-hidden="true"
    >
      <Paperclip class="mr-2 size-4" />
      Drop files to attach
    </div>
    <input
      ref="fileInput"
      type="file"
      multiple
      :accept="fileAccept"
      class="hidden"
      tabindex="-1"
      aria-hidden="true"
      @change="onFilesPicked"
    />
  </div>
</template>
