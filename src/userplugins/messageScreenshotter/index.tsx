import {definePluginSettings} from "@api/Settings";
import definePlugin, {OptionType} from "@utils/types";
import {ChannelStore, MessageStore, React, Select, UserStore} from "@webpack/common";
import {Icon} from "@equicordplugins/translatePlus/utils/icon";
import {findComponentByCodeLazy} from "@webpack";
import {ModalCloseButton, ModalContent, ModalHeader, ModalRoot, ModalSize, openModal} from "@utils/modal";
import ErrorBoundary from "@components/ErrorBoundary";
import {Message, SelectOption} from "../../../packages/discord-types";
import {MessageFlags, MessageType} from "../../../packages/discord-types/enums";
import {getSelectedMessages} from "../messageSelecting";
import {Button} from "@components/Button";
import {Heading} from "@components/Heading";
import {q} from "@equicordplugins/questify/utils/misc";

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
    },
    roleImage: {
        description: "What to do with the role image",
        type: OptionType.SELECT,
        options: [
            { label: "Do Nothing", value: "none", default: true },
            { label: "Remove", value: "remove" },
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
    if (message.type != MessageType.DEFAULT)                                                            return true
    if (!(previousMessage.type == MessageType.DEFAULT || previousMessage.type == MessageType.REPLY))    return true
    if (message.hasFlag(MessageFlags.EPHEMERAL) || previousMessage.hasFlag(MessageFlags.EPHEMERAL))     return true
    if (previousMessage.timestamp.toDateString() !== message.timestamp.toDateString())                  return true
    return false
}

function getNewName(settingsGetter: (name: string, user?: string) => string, originalName: string, id: string) {
    const mode = settingsGetter("names", id);

    if (mode === "underscore") {
        const nameLength = originalName.length;
        return settingsGetter("blurCharacter", id).repeat(nameLength);
    }
    if (mode === "underscore_first_last") {
        const nameLength = originalName.length;
        return originalName[0] + settingsGetter("blurCharacter", id).repeat(nameLength-2) + originalName[nameLength-1];
    }
    if (mode === "blur") {
        const nameLength = lengthFromString(id);
        return settingsGetter("blurCharacter", id).repeat(nameLength);
    }

    return originalName
}

function shouldApplyColorForId(settingsGetter: (name: string, user?: string) => string, id: string) {
    if (settingsGetter("changeNameColor", id) == "false") return false;
    if (settingsGetter("names", id) !== "blur") return false;
    return true;
}

function applyColorToElement(settingsGetter: (name: string, user?: string) => string, elem: Element | null, id: string) {
    if (!elem || !(elem instanceof HTMLElement)) return;
    if (shouldApplyColorForId(settingsGetter, id)) {
        const hex = colorFromString(id);
        elem.style.setProperty("color", hex);
    }
}

function MessageItem({
                         message,
                         shouldSplit,
                         clazz,
                         settingsGetter
                     }: {
    message: Message,
    shouldSplit: boolean,
    clazz: string,
    settingsGetter: (name: string, user?: string) => string
}) {
    const liRef = React.useRef<HTMLLIElement | null>(null);

    React.useEffect(() => {
        const root = liRef.current

        // region main message

        const mainMessageElement = root?.querySelector(".contents_c19a55")

        // region username text and color
        const usernameElement = mainMessageElement?.querySelector(".username_c19a55");
        if (!usernameElement) return;

        usernameElement.textContent = getNewName(settingsGetter, usernameElement.textContent, message.author.id)
        applyColorToElement(settingsGetter, usernameElement, message.author.id);
        // endregion username text and color

        // region role image

        //roleIcon_c19a55
        const roleIconElement = mainMessageElement?.querySelector(".roleIcon_ee71ee")
        if (settingsGetter("roleImage", message.author.id) === "remove" && roleIconElement) {
            const parent = roleIconElement.parentElement!
            const itsParent = parent.parentElement!
            itsParent.removeChild(parent)
        }
        // endregion role image

        // region pfp color
        const pfpElement = mainMessageElement?.querySelector(".avatar_c19a55")
        if (settingsGetter("pfp", message.author.id) === "solid_color") {
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
            if (settingsGetter("serverTag", message.author.id) === "remove") {
                const parent = serverTagElement.parentElement
                parent?.parentElement?.removeChild(parent)
            }
        }
        // endregion server tag

        // region pinged people

        const messageContentElement = mainMessageElement?.querySelector(".messageContent_c19a55")!;

        let i = 0
        let mentions = [...message.content.matchAll(/<@(\d+)>/g)].map(m => m[1]);

        Array.from(messageContentElement.children).forEach((child) => {
            if (child.classList.contains("mention") && child instanceof HTMLSpanElement) {
                const userMentioned = mentions[i]
                child.innerText = "@" + getNewName(settingsGetter, child.innerText.slice(1), userMentioned)
                i++
            }
        })

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
                name = "@" + getNewName(settingsGetter, name.slice(1), replyMessage.author.id)
            } else {
                name = getNewName(settingsGetter, name, replyMessage.author.id)
            }
            replyUsernameElement.textContent = name
            applyColorToElement(settingsGetter, replyUsernameElement, replyMessage.author.id);
        }
        // endregion username text and color

        // region pfp color
        const replyPfpElement = replyElement?.querySelector(".replyAvatar_c19a55")
        if (settingsGetter("pfp", replyMessage.author.id) === "solid_color") {
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
            if (settingsGetter("serverTag", replyMessage.author.id) === "remove") {
                const parent = replyServerTagElement.parentElement
                parent?.parentElement?.removeChild(parent)
            }
        }
        // endregion server tag

        // region pinged people

        const replyMessageContentElement = replyElement?.querySelector(".repliedTextContent_c19a55")!;

        i = 0
        mentions = [...replyMessage.content.matchAll(/<@(\d+)>/g)].map(m => m[1]);

        Array.from(replyMessageContentElement.children).forEach((child) => {
            if (child.classList.contains("mention") && child instanceof HTMLSpanElement) {
                const userMentioned = mentions[i]
                child.innerText = "@" + getNewName(settingsGetter, child.innerText.slice(1), userMentioned)
                i++
            }
        })

        // endregion pinged people

        // endregion reply message
    }, [message, settings, settingsGetter]);

    return (
        <li
            ref={liRef}
            id={"chat-messages-" + message.channel_id + "-" + message.id}
            className={"messageListItem__5126c"}
            key={`msg-wrap-${message.id}`}
            aria-setsize={-1}
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
    const [settingsActive, setSettingsActive] = React.useState(true);
    const [selectedUser, setSelectedUser] = React.useState<string | null>(null);

    function getReply(message: Message) {
        const replyId = message.messageReference?.message_id
        const replyChannelId = message.messageReference?.channel_id
        if (!replyId || !replyChannelId) return null;
        return MessageStore.getMessage(replyChannelId, replyId) || null;
    }

    function getUsers(messages: Message[]): SelectOption[] {
        const seen = new Set<string>();
        const result: SelectOption[] = [];
        for (const m of messages) {
            let userIds: {id: string, name: string}[] = [];

            userIds.push({id: m.author.id, name: m.author.username})
            const reply = getReply(m)
            if (reply) {
                userIds.push({id: reply.author.id, name: reply.author.username})

                const mentions = [...reply.content.matchAll(/<@(\d+)>/g)].map(m => m[1]);
                for (const mention of mentions) {
                    userIds.push({id: mention, name: UserStore.getUser(mention).username})
                }
            }
            const mentions = [...m.content.matchAll(/<@(\d+)>/g)].map(m => m[1]);

            for (const mention of mentions) {
                userIds.push({id: mention, name: UserStore.getUser(mention).username})
            }

            for (const user of userIds) {
                if (!seen.has(user.id)) {
                    seen.add(user.id);
                    result.push({ label: user.name, value: user.id });
                }
            }
        }
        result[0] = {...result[0], default: true}
        return result;
    }

    const [overrideSettings, setOverrideSettings] = React.useState<Map<string, Map<string, string>>>(new Map());

    function setValue(user: string, settingName: string, value: string) {
        setOverrideSettings(prev => {
            const next = new Map(prev);
            if (!next.has(user)) {
                next.set(user, new Map());
            }
            next.set(user, new Map(next.get(user)!).set(settingName, value));
            return next;
        });
    }

    function setSetting(name: string, v: string) {
        setValue(selectedUser!, name, v)
    }
    function getSetting(name: string, user?: string): string {
        user = (user || selectedUser)!;

        const userMap = overrideSettings.get(user);

        if (userMap) {
            const value = userMap.get(name);
            if (value) {
                return String(value);
            }
        }
        return String(settings.store[name])
    }

    const settingsKey = React.useMemo(() =>
            JSON.stringify([...overrideSettings.entries()].map(([k, v]) => [k, [...v.entries()]])),
        [overrideSettings]
    );

    return (
        <div
            style={{
                backgroundColor: "#1A1A1E",
                paddingBottom: "30px",
                paddingLeft: "30px",
                paddingRight: "30px",
                paddingTop: "15px",
                minHeight: "500px",
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
                        bottom: "30px",
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
                    <Heading className={q("form-subtitle")}>
                        Select user
                    </Heading>
                    <Select
                        options={getUsers(messages)}
                        select={v => {
                            setSelectedUser(v)
                        }}
                        isSelected={v => {
                            return v == selectedUser
                        }}
                        serialize={v => String(v) }
                    >
                    </Select>

                    <Heading className={q("form-subtitle")}>
                        Names
                    </Heading>
                    <Select
                        options={settings.def.names.options}
                        select={v => {
                            setSetting("names", v)
                        }}
                        isSelected={v => {
                            return getSetting("names") === v
                        }}
                        serialize={v => String(v) }
                        placeholder = {getSetting("names")}
                    >
                    </Select>

                    <Heading className={q("form-subtitle")}>
                        Server tag
                    </Heading>
                    <Select
                        options={settings.def.serverTag.options}
                        select={v => {
                            setSetting("serverTag", v)
                        }}
                        isSelected={v => {
                            return getSetting("serverTag") === v
                        }}
                        serialize={v => String(v) }
                        placeholder = {getSetting("serverTag")}
                    >
                    </Select>

                    <Heading className={q("form-subtitle")}>
                        Profile picture
                    </Heading>
                    <Select
                        options={settings.def.pfp.options}
                        select={v => {
                            setSetting("pfp", v)
                        }}
                        isSelected={v => {
                            return getSetting("pfp") === v
                        }}
                        serialize={v => String(v) }
                        placeholder = {getSetting("pfp")}
                    >
                    </Select>

                    <Heading className={q("form-subtitle")}>
                        Change name color
                    </Heading>
                    <Select
                        options={[{
                            label: "Yes",
                            value: "true",
                        }, {
                            label: "No",
                            value: "false",
                        }, ]}
                        select={v => {
                            setSetting("changeNameColor", v)
                        }}
                        isSelected={v => {
                            return getSetting("changeNameColor") == v
                        }}
                        serialize={v => String(v) }
                        placeholder = {getSetting("changeNameColor") ?? "false"}
                    >
                    </Select>

                    <Heading className={q("form-subtitle")}>
                        Blur character to be used
                    </Heading>
                    <Select
                        options={settings.def.blurCharacter.options}
                        select={v => {
                            setSetting("blurCharacter", v)
                        }}
                        isSelected={v => {
                            return getSetting("blurCharacter") === v
                        }}
                        serialize={v => String(v) }
                        placeholder = {getSetting("blurCharacter")}
                    >
                    </Select>

                    <Heading className={q("form-subtitle")}>
                        What to do with the role image
                    </Heading>
                    <Select
                        options={settings.def.roleImage.options}
                        select={v => {
                            setSetting("roleImage", v)
                        }}
                        isSelected={v => {
                            return getSetting("roleImage") === v
                        }}
                        serialize={v => String(v) }
                        placeholder = {getSetting("roleImage")}
                    >
                    </Select>
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
                                key={String(message.id) + settingsKey}
                                message={message}
                                shouldSplit={shouldSplit}
                                clazz={clazz}
                                settingsGetter={getSetting}
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
