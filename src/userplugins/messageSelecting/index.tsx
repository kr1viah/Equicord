import definePlugin from "@utils/types";
import {ChannelStore, MessageStore} from "@webpack/common";
import {Icon} from "@equicordplugins/translatePlus/utils/icon";
import {Message} from "../../../packages/discord-types";
import {enableStyle} from "@api/Styles";
import textStyle from "./highlightStyle.css?managed";
import {forEach} from "lodash";

interface ChannelSelectEvent {
    type: "CHANNEL_SELECT";
    channelId: string | null;
    guildId: string | null;
}

function PopOverIcon() {
    return (
        <svg fill="var(--text-default)" width={24} height={24} viewBox={"0 0 64 64"}>
            <rect x="3" y="5" width="60" height="56" rx="2" ry="2" stroke-width="2"/>
            <path d="M7 12l3 3 7-7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
    );
}

function handleMessage(message: Message) {
    const domElement = document.getElementById(
        `chat-messages-${message.channel_id}-${message.id}`,
    );
    if (!domElement) return;

    enableStyle(textStyle);
    if (selectedMessages.includes(message)) {
        selectedMessages.splice(selectedMessages.indexOf(message), 1)
        domElement.classList.toggle("messageselector-selected", false)
    } else {
        if (!selectedMessages.find(m2 => m2.id === message.id)) {
            selectedMessages.push(message)
            domElement.classList.toggle("messageselector-selected", true)
        }
    }

}

const selectedMessages: Message[] = []

export function getSelectedMessages() {
    let updatedMessages: Message[] = []

    selectedMessages.forEach((message: Message) => {
        message = MessageStore.getMessage(message.channel_id, message.id) ?? message;
        updatedMessages.push(message)
    })
    updatedMessages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())

    return updatedMessages
}


export default definePlugin({
    name: "MultiSelect",
    description: "Allows you to select (multiple) messages",
    authors: [{
        name: "kr1v",
        id: 1082702127014625371n
    }],

    onMessageClick(msg, channel, event) {
        if (selectedMessages.length !== 0) {
            handleMessage(msg)
        }
    },

    flux: {
        async CHANNEL_SELECT({ guildId, channelId }: ChannelSelectEvent) {
            selectedMessages.length = 0
        }
    },

    messagePopoverButton: {
        icon: Icon,
        render(message) {
            return {
                label: "Select/unselect",
                icon: PopOverIcon,
                message: message,
                channel: ChannelStore.getChannel(message.channel_id),
                onClick: () => {
                    handleMessage(message)
                },
            };
        }
    }
});
