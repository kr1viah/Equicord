import {definePluginSettings} from "@api/Settings";
import definePlugin, {OptionType} from "@utils/types";
import {ChannelStore, MessageStore, React, UserStore} from "@webpack/common";
import {Icon} from "@equicordplugins/translatePlus/utils/icon";
import {findComponentByCodeLazy} from "@webpack";
import {ModalCloseButton, ModalContent, ModalHeader, ModalRoot, ModalSize, openModal} from "@utils/modal";
import ErrorBoundary from "@components/ErrorBoundary";
import {Message} from "../../../packages/discord-types";
import {MessageFlags, MessageType} from "../../../packages/discord-types/enums";
import {getSelectedMessages} from "../messageSelecting";
import {Button} from "@components/Button";

const ChannelMessage = findComponentByCodeLazy("childrenExecutedCommand:", ".hideAccessories");

function PopOverIcon() {
    return (
        <svg fill="var(--text-default)" width={24} height={24} viewBox={"0 0 64 64"}>
            <rect x="10" y="14" width="44" height="36" rx="4" ry="4" fill="#e6e6e6" stroke="#333" stroke-width="3"/>
            <circle cx="32" cy="32" r="8" fill="#999" stroke="#333" stroke-width="2"/>
        </svg>
    );
}

const settings = definePluginSettings({
    names: {
        description: "What to do with the names of people",
        type: OptionType.SELECT,
        options: [
            { label: "Do Nothing", value: "none", default: true },
            { label: "Turn into underscores of the same length", value: "underscore" },
            { label: "Turn into underscores of the same length, but keep first and last letter the same", value: "underscore_first_last" },
            { label: "Blur using underscores based on the user id", value: "blur" },
        ]
    },
    serverTag: {
        description: "What to do with the server tags of people",
        type: OptionType.SELECT,
        options: [
            { label: "Do Nothing", value: "none", default: true },
            { label: "Remove", value: "remove" },
        ]
    },
    pfp: {
        description: "What to do with profile pictures",
        type: OptionType.SELECT,
        options: [
            { label: "Do Nothing", value: "none", default: true },
            { label: "Turn into solid color", value: "solid_color" },
        ]
    },
    changeNameColor: {
        description: "Change the color of the user when using the blur setting",
        type: OptionType.BOOLEAN
    },
    excludeYourself: {
        description: "Exclude yourself from blurring",
        type: OptionType.BOOLEAN
    },
    blurCharacter: {
        description: "Which character to use for blurring",
        type: OptionType.SELECT,
        options: [
            { label: "_", value: "_", default: true },
            { label: "-", value: "-" },
            { label: "█", value: "█" },
            { label: "—", value: "—" },
            { label: "▚", value: "▚" },
            { label: "━", value: "━" },
            { label: "─", value: "─" },
        ]
    }
});

function lengthFromString(str: string): number {
    let hash = 0;

    for (let i = 0; i < str.length; i++) {
        hash = (hash * 31 + str.charCodeAt(i)) | 0;
    }

    const range = 14;
    return 3+(Math.abs(hash) % range);
}

function colorFromString(str: string): string {
    let hash = 0;

    for (let i = 0; i < str.length; i++) {
        hash = (hash * 31 + str.charCodeAt(i)) | 0;
    }

    const r = (hash >> 16) & 255;
    const g = (hash >> 8) & 255;
    const b = hash & 255;

    return `#${[r, g, b]
        .map(v => (v & 255).toString(16).padStart(2, "0"))
        .join("")}`;
}

function shouldSplitF(message: Message, previousMessage: Message) {
    if (!previousMessage)                                                                               return true
    if (previousMessage.author.id !== message.author.id)                                                return true
    if (Math.abs(previousMessage.timestamp.getTime() - message.timestamp.getTime()) >= 7 * 60 * 1000)   return true
    if (!(message.type == MessageType.DEFAULT || message.type == MessageType.REPLY))                    return true
    if (!(previousMessage.type == MessageType.DEFAULT || previousMessage.type == MessageType.REPLY))    return true
    if (message.hasFlag(MessageFlags.EPHEMERAL) || previousMessage.hasFlag(MessageFlags.EPHEMERAL))     return true
    if (previousMessage.timestamp.toDateString() !== message.timestamp.toDateString())                  return true
    return false
}

function getNewName(originalName: string, id: string) {
    if (excludeMyself(id)) return originalName;
    const mode = settings.store.names;

    if (mode === "underscore") {
        const nameLength = originalName.length;
        return settings.store.blurCharacter.repeat(nameLength);
    }
    if (mode === "underscore_first_last") {
        const nameLength = originalName.length;
        return originalName[0] + settings.store.blurCharacter.repeat(nameLength-2) + originalName[nameLength-1];
    }
    if (mode === "blur") {
        const nameLength = lengthFromString(id);
        return settings.store.blurCharacter.repeat(nameLength);
    }

    return originalName
}

function shouldApplyColorForId(id: string) {
    if (!settings.store.changeNameColor) return false;
    if (settings.store.names !== "blur") return false;
    if (excludeMyself(id)) return false;
    return true;
}

function applyColorToElement(elem: Element | null, id: string) {
    if (!elem || !(elem instanceof HTMLElement)) return;
    if (shouldApplyColorForId(id)) {
        const hex = colorFromString(id);
        elem.style.setProperty("color", hex);
    }
}

function excludeMyself(id: string) {
    return id === UserStore.getCurrentUser().id && settings.store.excludeYourself;
}

function MessageItem({
                         message,
                         shouldSplit,
                         clazz,
                         settings,
                     }: {
    message: Message;
    shouldSplit: boolean;
    clazz: string;
    settings: any;
}) {
    const liRef = React.useRef<HTMLLIElement | null>(null);

    React.useEffect(() => {
        const root = liRef.current

        // region main message

        const mainMessageElement = root?.querySelector(".contents_c19a55")

        // region username text and color
        const usernameElement = mainMessageElement?.querySelector(".username_c19a55");
        if (!usernameElement) return;

        usernameElement.textContent = getNewName(usernameElement.textContent, message.author.id)
        applyColorToElement(usernameElement, message.author.id);
        // endregion username text and color

        // region pfp color
        const pfpElement = mainMessageElement?.querySelector(".avatar_c19a55")
        if (settings.store.pfp === "solid_color" && !excludeMyself(message.author.id)) {
            if (pfpElement instanceof HTMLImageElement) {
                const hex = colorFromString(message.author.id);

                const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
	<rect width="100%" height="100%" fill="${hex}"/>
</svg>
`;
                pfpElement.src = "data:image/svg+xml," + encodeURIComponent(svg);
            }

            const avatarDecorationElement = mainMessageElement?.querySelector(".avatarDecoration_c19a55")
            if (avatarDecorationElement) {
                mainMessageElement?.removeChild(avatarDecorationElement);
            }
        }
        // endregion pfp color

        // region server tag
        const serverTagElement = mainMessageElement?.querySelector(".clanTagChiplet_c19a55")
        if (serverTagElement) {
            if (settings.store.serverTag === "remove" && !excludeMyself(message.author.id)) {
                const parent = serverTagElement.parentElement
                parent?.parentElement?.removeChild(parent)
            }
        }
        // endregion server tag

        // region pinged people

        // class `mention`

        const messageContentElement = mainMessageElement?.querySelector(".messageContent_c19a55")!;

        let i = 0
        const mentions = [...message.content.matchAll(/<@(\d+)>/g)].map(m => m[1]);

        Array.from(messageContentElement.children).forEach((child) => {
            if (child.classList.contains("mention") && child instanceof HTMLSpanElement) {
                const userMentioned = mentions[i]
                child.innerText = "@" + getNewName(child.innerText.slice(1), userMentioned)
                i++
            }
        })

        console.log(message.mentions)
        console.log(message.content)

        // endregion pinged people

        // endregion main message

        // region reply message

        if (message.type !== MessageType.REPLY) {
            return
        }

        const replyElement = root?.querySelector(".repliedMessage_c19a55")
        const replyMessageId = message.messageReference?.message_id!
        const replyMessageChannelId = message.channel_id
        const replyMessage = MessageStore.getMessage(replyMessageChannelId, replyMessageId);

        if (!replyMessage && message.type === MessageType.REPLY) {
            throw new Error("A message in your screenshot has a reply, but that message is not formally loaded. Please load all messages (including replies) in the screenshot fully.")
        }

        // region username text and color
        const replyUsernameElement = replyElement?.querySelector(".username_c19a55");
        if (replyUsernameElement) {
            let name = replyUsernameElement.textContent
            if (name.startsWith("@")) {
                name = "@" + getNewName(name.slice(1), replyMessage.author.id)
            } else {
                name = getNewName(name, replyMessage.author.id)
            }
            replyUsernameElement.textContent = name
            applyColorToElement(replyUsernameElement, replyMessage.author.id);
        }
        // endregion username text and color

        // region pfp color
        const replyPfpElement = replyElement?.querySelector(".replyAvatar_c19a55")
        if (settings.store.pfp === "solid_color" && !excludeMyself(replyMessage.author.id)) {
            if (replyPfpElement instanceof HTMLImageElement) {
                const hex = colorFromString(replyMessage.author.id);

                const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
	<rect width="100%" height="100%" fill="${hex}"/>
</svg>
`;
                replyPfpElement.src = "data:image/svg+xml," + encodeURIComponent(svg);
            }

            const avatarDecorationElement = replyElement?.querySelector(".avatarDecoration_c19a55")
            if (avatarDecorationElement) {
                replyElement?.removeChild(avatarDecorationElement);
            }
        }
        // endregion pfp color

        // region server tag
        const replyServerTagElement = replyElement?.querySelector(".clanTagChiplet_c19a55")
        if (replyServerTagElement) {
            if (settings.store.serverTag === "remove" && !excludeMyself(replyMessage.author.id)) {
                const parent = replyServerTagElement.parentElement
                parent?.parentElement?.removeChild(parent)
            }
        }
        // endregion server tag

        // endregion reply message
    }, [message, settings]);

    return (
        <li
            ref={liRef}
            id={"chat-messages-" + message.channel_id + "-" + message.id}
            className={"messageListItem__5126c"}
            key={`msg-wrap-${message.id}`}
            aria-setsize={-1}
            style={{ width: "1000px" }}
        >
            <ChannelMessage
                message={message}
                channel={ChannelStore.getChannel(message.channel_id)}
                subscribeToComponentDispatch={false}
                animateAvatar={false}
                isGroupStart={shouldSplit}
                compact={false}
                renderThreadAccessory={true}
                class={clazz}
                role={"article"}
                data-list-item-id={
                    "chat-messages___chat-messages-" + message.channel_id + "-" + message.id
                }
                aria-setsize={-1}
                aria-roledescription={"Message"}
            />
        </li>
    );
}

function MessageListModal({ messages }: { messages: Message[] }) {
    const [settingsActive, setSettingsActive] = React.useState(false);
    if (!settingsActive) {
        setSettingsActive(true);
    }
    return (
        <div
            style={{
                backgroundColor: "#1A1A1E",
                paddingBottom: "30px",
                paddingLeft: "30px",
                paddingRight: "30px",
                paddingTop: "15px",
                // padding: "16px",
            }}
        >
            <Button onClick={() => setSettingsActive(v => !v)}>
                Toggle settings
            </Button>
            {settingsActive && (
                <div
                    style={{
                        position: "absolute",
                        top: "30px",
                        right: "30px",
                        width: 320,
                        background: "#111",
                        borderRadius: 12,
                        padding: 12,
                        zIndex: 10,
                        boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
                        alignSelf: "right",
                        color: "#fff",
                    }}
                >
                </div>
            )}
            <div className="scrollerContent__36d07 content_d125d2">
                <ol
                    className="scrollerInner__36d07 group-spacing-16"
                    aria-label={""}
                    role={"list"}
                    data-list-id={"chat-messages"}
                    tabIndex={0}
                    aria-orientation="vertical"
                >
                    {messages.map((message, i) => {
                        const prev = i > 0 ? messages[i - 1] : undefined;
                        const shouldSplit = shouldSplitF(message, prev as any);
                        let clazz = "message__5126c cozyMessage__5126c wrapper_c19a55 cozy_c19a55 zalgo_c19a55";
                        if (shouldSplit) clazz += " groupStart__5126c";
                        if (message.mentioned) clazz += " mentioned__5126c";

                        return (
                            <MessageItem
                                key={String(message.id)}
                                message={message}
                                shouldSplit={shouldSplit}
                                clazz={clazz}
                                settings={settings}
                            />
                        );
                    })}
                </ol>
            </div>
        </div>
    );
}

function takeScreenshot(selectedMessages: Message[]) {
    openModal((props: any) => (
        <ModalRoot size={ModalSize.LARGE} {...props}>
            <ModalHeader className={("screenshot-modal-header")}>
                <span style={{color: "#FFF"}}>Screenshot</span>
                <ModalCloseButton onClick={props.onClose} />
            </ModalHeader>
            <ModalContent className={("screenshot-modal")}>
                <ErrorBoundary>
                    <MessageListModal messages={selectedMessages}/>
                </ErrorBoundary>
            </ModalContent>
        </ModalRoot>
    ));
}
export default definePlugin({
    name: "MessageScreenshot",
    description: "Screenshot selected messages. qqq", // qqq for quick lookup
    authors: [{
        name: "kr1v",
        id: 1082702127014625371n
    }],
    settings,
    dependencies: ["MultiSelect"],

    messagePopoverButton: {
        icon: Icon,
        render(message) {
            return {
                label: "Screenshot",
                icon: PopOverIcon,
                message: message,
                channel: ChannelStore.getChannel(message.channel_id),
                onClick: () => {
                    let selectedMessages = getSelectedMessages()

                    if (selectedMessages.length === 0) {
                        selectedMessages.push(message)
                    }

                    let clone: Message[] = []

                    selectedMessages.forEach(message => {
                        clone.push(message.addReactionBatch([], []))
                    })

                    takeScreenshot(clone)
                },
            };
        }
    }
});
