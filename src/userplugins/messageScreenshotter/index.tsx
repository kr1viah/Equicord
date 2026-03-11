import {definePluginSettings} from "@api/Settings";
import definePlugin, {OptionType} from "@utils/types";
import {ChannelStore} from "@webpack/common";
import {Icon} from "@equicordplugins/translatePlus/utils/icon";
import {findComponentByCodeLazy} from "@webpack";
import {openModal} from "@utils/modal";
import ErrorBoundary from "@components/ErrorBoundary";
import React from "react";
import {Message} from "../../../packages/discord-types";
import {MessageFlags, MessageType} from "../../../packages/discord-types/enums";
import {getSelectedMessages} from "../messageSelecting";

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
    clickAction: {
        description: "Action to perform when clicking on a message",
        type: OptionType.SELECT,
        options: [
            { label: "Do Nothing", value: "none", default: true },
            { label: "Show Alert", value: "alert" },
            { label: "Copy Message", value: "copy" },
            { label: "Select message", value: "select" }
        ]
    }
});

function shouldSplitF(message: Message, previousMessage: Message) {
    if (!previousMessage)                                                                               return true
    if (previousMessage.author.id !== message.author.id)                                                return true
    if (Math.abs(previousMessage.timestamp.getTime() - message.timestamp.getTime()) >= 7 * 60 * 1000)   return true
    if (!(message.type == MessageType.DEFAULT || message.type == MessageType.REPLY))                    return true
    if (!(previousMessage.type == MessageType.DEFAULT || previousMessage.type == MessageType.REPLY))    return true
    if (message.webhookId || previousMessage.webhookId)                                                 return true
    if (message.interactionData || message.interactionMetadata)                                         return true
    if (previousMessage.interactionData || previousMessage.interactionMetadata)                         return true
    if (message.hasFlag(MessageFlags.EPHEMERAL) || previousMessage.hasFlag(MessageFlags.EPHEMERAL))     return true
    if (previousMessage.timestamp.toDateString() !== message.timestamp.toDateString())                  return true
    return false
}

function takeScreenshot(selectedMessages: Message[]) {
    const messages: React.JSX.Element[] = []
    let prevMessage: Message;

    selectedMessages.forEach(message => {
        let shouldSplit = shouldSplitF(message, prevMessage);

        let clazz = "message__5126c cozyMessage__5126c wrapper_c19a55 cozy_c19a55 zalgo_c19a55"
        if (shouldSplit) clazz += " groupStart__5126c"
        if (message.mentioned) clazz += " mentioned__5126c"
        // isSystemMessage_c19a55
        // systemMessage__5126c

        const messageElement: React.JSX.Element = <ChannelMessage
            message={message}
            channel={ChannelStore.getChannel(message.channel_id)}
            subscribeToComponentDispatch={false}
            animateAvatar={false}
            isGroupStart={shouldSplit}
            compact={false}
            renderThreadAccessory={true}
            class={clazz}
            role={"article"}
            data-list-item-id={"chat-messages___chat-messages-" + message.channel_id + "-" + message.id}
            aria-setsize={-1}
            aria-roledescription={"Message"}
        />

        messages.push(
            <li
                id={"chat-messages-" + message.channel_id + "-" + message.id}
                className={"messageListItem__5126c"}
                aria-setsize={-1}
                // key={`msg-wrap-${message.id}`}
                // style={{ alignSelf: "flex-start", display: "inline-block" }}
            >
                {messageElement}
            </li>
        )
        prevMessage = message
    });

    openModal(props =>
        <ErrorBoundary>
                <div
                    className="scrollerContent__36d07 content_d125d2"
                >
                    <ol
                        className="scrollerInner__36d07 group-spacing-16"
                        style={{
                            backgroundColor: "#1A1A1E"
                        }}
                        aria-label={""}
                        role={"list"}
                        data-list-id={"chat-messages"}
                        tabIndex={0}
                        aria-orientation="vertical"
                    >
                        {messages}
                    </ol>
                </div>
        </ErrorBoundary>
);
}

export default definePlugin({
    name: "MessageScreenshot",
    description: "Screenshot selected messages",
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
                    takeScreenshot(selectedMessages)
                },
            };
        }
    }
});
